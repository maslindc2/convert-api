const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs-extra');
const sharp = require('sharp');

const app = express();
const PORT = 3000;

//Initializing fileUpload
app.use(fileUpload());


/**
 * Sets up required directories
 * if processed/upload dir exists -> make sure it's empty
 * if processed/upload dir DNE -> create the directories
 */
fs.emptyDir('./processed');
fs.emptyDir('./uploaded');


// Start listening for requests on assigned port
app.listen(PORT, () => {
    console.log(`Listening on PORT ${PORT}`);
});

// Upload endpoint
app.post('/upload', function(req, res) {
    // Check to see if files were uploaded
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }
    

    let uploadedImg = req.files.imgToUpload;

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
                fs.move(uploadedFilePath, processedFilePath);
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

/**
app.post('/multi', function(req, res){
    // Check to see if files were uploaded
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }
    let temp;
    temp = req.files.imgToUpload;
    console.log(temp.length);
    res.status(200);
});
 */



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
                fs.remove(uploadedFilePath);
            }).then(() =>{
                res.send('Converted to jpg check processed')
            });

    }else if(req.body.fileExt === 'png'){
        sharp(uploadedFilePath)
            .png()
            .toFile(processedFilePath)
            .then(() => {
                fs.remove(uploadedFilePath);
            }).then(() => {
                res.send('Converted to png check processed');
            });

    }else if(req.body.fileExt === 'webp'){
        sharp(uploadedFilePath)
            .webp({effort: 0})
            .toFile(processedFilePath)
            .then(() => {
                fs.remove(uploadedFilePath);
            }).then(() => {
                res.send('Converted to webp check processed');
            });
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
            fs.remove(uploadedFilePath)
        }).then(() => {
            //Try and trigger a download
            //res.sendFile(processedFilePath, {headers: {'Content-Type': 'image/jpeg'}});
            res.send('Resized check processed');
        });
}