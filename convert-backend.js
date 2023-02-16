require('dotenv').config();

const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs-extra');
const sharp = require('sharp');
const AdmZip = require('adm-zip');
const app = express();

//Initializing fileUpload
app.use(fileUpload());


/**
 * Sets up required directories
 * if processed/upload dir exists -> make sure it's empty
 * if processed/upload dir DNE -> create the directories
 */
fs.emptyDir('./processed');
fs.emptyDir('./uploaded');
fs.emptyDir('./zipped');

// Start listening for requests on assigned port
app.listen(process.env.PORT, () => {
    console.log(`Listening on PORT ${process.env.PORT}`);
});

// Upload endpoint
app.post('/upload', async function(req, res) {
    console.log(req);
    // Check to see if files were uploaded
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }
    
    // Because JS is special imgToUpload when multiple files are uploaded, it's an array. When a single image is uploaded it is not.
    // To support processing multiple images we check if the length is undefined. If a single image is uploaded store it to an array and process it
    // if not change the imgs variable from an empty array to the imgToUpload array
    let imgs = [];
    if(req.files.imgToUpload.length === undefined)
        imgs.push(req.files.imgToUpload);
    else
        imgs = req.files.imgToUpload;
    
    setupImageProcessing(req, res, imgs);
    
    // Zip all of the files in the processed directory and send the download
    function zipProcessed() {
        const zip = new AdmZip();
        //Give a timestamp to the zipped folder
        var timestamp = new Date().getTime();
        const outputFile = `./zipped/Processed_Images_${Math.floor(timestamp / 1000)}.zip`;
        zip.addLocalFolder("./processed");
        zip.writeZip(outputFile);
        res.download(outputFile);

        //Clean out processed and zipped directories
        fs.emptyDir('./processed');
        fs.emptyDir('./zipped');
    }

    //If imgs array contains one image we need to set the appropriate amount of time to wait until the image has processed
    if (imgs.length === 1) {
        setTimeout(zipProcessed, env.MOD_Batch);
    } else {
        //delay the start of zip operation by length of imgs * modifier (num of ms it takes on avg to process an img)
        setTimeout(zipProcessed, imgs.length*process.env.MOD_Single);    
    }
    
});

function setupImageProcessing(req, res, imgs) {
    imgs.forEach(uploadedImg => {
        
        /**
         * Setting correct file name
         * - If resize was requested use the original file name which includes the original file extension
         * - If convert was requested use the original file name and change the extension to the converted ext (ie: original ext is .png converted ext is .webp)
         */
        let convertedFileName;

        // If resize was requested or converted file ext was left empty use the original file extension
        if(req.body.fileExt === "empty"){
            convertedFileName = uploadedImg.name;
        }else{
            // Split the uploaded file name into [file name, file ext] get the name and append the converted extension to it
            convertedFileName = uploadedImg.name.split('.')[0] + '.' + req.body.fileExt;
        }
        
        let uploadedFilePath = "./uploaded/" + uploadedImg.name; // get the uploaded image and it's path
        let processedFilePath = "./processed/" + convertedFileName; // where the processed file will be stored and it's name

        //Use the mv() method to place the file in the "/uploaded" dir on the server
        uploadedImg.mv(uploadedFilePath, function(err) {
            if (err)
                return res.status(500).send(err);
            
            //Run the convert function if it was selected
            if(req.body.function === 'convert'){
                
                // If the "Convert the image to" dropdown was the same file extension as the uploaded img 
                // DO NOT perform the conversion just return the uploaded file
                if(req.body.function === 'convert' && req.body.fileExt === uploadedImg.name.split('.')[1]){
                    fs.moveSync(uploadedFilePath, processedFilePath);
                    res.send('No conversion needed check processed');

                //Otherwise perform the conversion
                }else{
                    convert(req, res, uploadedFilePath, processedFilePath);
                }    
            }
            
            //Call the resize function
            if(req.body.function === 'resize')
                resize(req, res, uploadedFilePath, processedFilePath);
        });
    });
}



/**
 * Convert the image using Sharp,  Jpeg conversion is set to highest quality jpeg, PNG by default is lossless, Webp is compressed and uses highest CPU setting
 * @param {*} req contains the request from the frontend. Used for determining what to convert the uploaded file to
 * @param {*} res 
 * @param {*} uploadedFilePath contains the location of the uploaded file
 * @param {*} processedFilePath where the processed file should be stored
 */
function convert(req, res, uploadedFilePath, processedFilePath) {
    if(req.body.fileExt === 'jpg'){
        sharp(uploadedFilePath)
            .jpeg({
                quality: 100,
                chromaSubsampling: '4:4:4'
            })
            .toFile(processedFilePath)
            .then(() => {
                fs.removeSync(uploadedFilePath);
            });

    }else if(req.body.fileExt === 'png'){
        sharp(uploadedFilePath)
            .png()
            .toFile(processedFilePath)
            .then(() => {
                fs.removeSync(uploadedFilePath);
            })

    }else if(req.body.fileExt === 'webp'){
        sharp(uploadedFilePath)
            .webp({effort: 0})
            .toFile(processedFilePath)
            .then(() => {
                fs.removeSync(uploadedFilePath);
            })
    }else{
        res.status(400).send('No conversion performed options not selected');
    }
}

/**
 * Resize the image using Sharp,  Resizing is done using the default fill mode, process avoids any weird stretching/scaling problems
 * @param {*} req contains the request from the frontend. Used for determining what resolution to resize the image to
 * @param {*} res 
 * @param {*} uploadedFilePath contains the location of the uploaded file
 * @param {*} processedFilePath where the processed file should be stored
 */
function resize(req, res, uploadedFilePath, processedFilePath) {
    sharp(uploadedFilePath)
        //Resize input file and write it to export path
        .resize(parseInt(req.body.width), parseInt(req.body.height))
        .toFile(processedFilePath)
        .then(() => {
            //remove the uploaded file from uploaded folder 
            fs.removeSync(uploadedFilePath)
        })
}