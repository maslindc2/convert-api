const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');

const app = express();
const PORT = 3000;

//Initializing fileUpload
app.use(fileUpload());


let uploadPath;

let exportPath = './processed/';

/**
 * Sets up required directories
 * if processed/upload dir exists -> make sure it's empty
 * if processed/upload dir DNE -> create them
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
    uploadPath = './uploaded/' + uploadedImg.name;

    //Storing the name of the new file (split the uploaded file name into [file name, ext] get the name and append the converted extension to it)
    let convertedFileName = uploadedImg.name.split('.')[0] + '.' + req.body.fileExt;
    
    //Use the mv() method to place the file in the "/uploaded" dir on the server
    uploadedImg.mv(uploadPath, function(err) {
        if (err)
            return res.status(500).send(err);
        //Check to see what mode was selected pulled from the request body    
        if(req.body.function === 'convert'){
            convert(req, res, convertedFileName);
        }else if(req.body.function === 'resize'){
            resize(req, res, convertedFileName);
        }else{
            res.status(400).send('Error no selection was made for the function');
        }
    })
});


function convert(req, res, convertedFileName) {
    if(req.body.fileExt === 'jpg'){
        sharp(uploadPath)
            .jpeg({
                quality: 100,
                chromaSubsampling: '4:4:4'
            })
            .toFile(exportPath + convertedFileName)
            .then(() => {
                fs.remove(uploadPath);
            }).then(() =>{
                res.send('Converted to jpg check processed')
            });

    }else if(req.body.fileExt === 'png'){
        sharp(uploadPath)
            .png()
            .toFile(exportPath + convertedFileName)
            .then(() => {
                fs.remove(uploadPath);
            }).then(() => {
                res.send('Converted to png check processed');
            });

    }else if(req.body.fileExt === 'webp'){
        sharp(uploadPath)
            .webp({effort: 0})
            .toFile(exportPath + convertedFileName)
            .then(() => {
                fs.remove(uploadPath);
            }).then(() => {
                res.send('Converted to webp check processed');
            });

    }else{
        res.status(400).send('No conversion performed options not selected');
    }
}

function resize(req, res) {
    sharp(uploadPath)
        //Resize input file and write it to export path
        .resize(parseInt(req.body.width), parseInt(req.body.height))
        .toFile(exportPath + req.files.imgToUpload.name)
        .then(() => {
            //remove the uploaded file from uploaded folder 
            fs.remove(uploadPath)
        }).then(() => {
            res.send('resized image check processed');
        });
}