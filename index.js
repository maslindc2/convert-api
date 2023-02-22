require('dotenv').config();
const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs-extra');
const crypto = require('crypto');

//Import the job processor class
const JobProcessor = require('./sharp-processor.js');

const app = express();

// Initializing fileUpload
app.use(fileUpload());


// Create the Jobs directory where each processing job will be located
fs.emptyDir('./tmp/Jobs');


// Start listening for requests on assigned port
app.listen(process.env.PORT, () => {
    console.log(`Listening on PORT ${process.env.PORT}`);
});

app.get('/', (req, res) =>{
    res.send("Welcome to Convert API. ");
})

// This is where we will store pending jobs
var JOB_QUEUE=[];

// Upload endpoint
app.post('/upload', (req, res) => {
    // Check to see if files were uploaded in the request body
    if (!req.files || Object.keys(req.files).length === 0)
        return res.status(400).send('No files were uploaded.');
    
    // Imgs array used for storing the location of the uploaded images
    let imgsArray = [];

    // If only one image was uploaded it is simply an image object so we push it to an array
    if(req.files.imgToUpload.length === undefined)
        imgsArray.push(req.files.imgToUpload);
    // Since multiple images automatically get put into an array (by either javascript or file-upload) we set the imgsArray var to the array from the request body
    else
        imgsArray = req.files.imgToUpload;

    // Creating a UUID for the current job
    let uuid = crypto.randomUUID()
    // Create a new job with the UUID, request and imgsArray
    let job = new JobProcessor(uuid, req, imgsArray);
    // Push the new job to the JOB_QUEUE
    JOB_QUEUE.push(job);

    // Since we have a job run the checkJobQueue
    checkJobQueue(req, res, uuid, imgsArray);

});


// UUID Download endpoint: after a file has been processed we are redirected to this endpoint and download the zip file
app.get('/download/:uuid', (req, res) =>{
    res.download(`./tmp/Jobs/${req.params.uuid}/zipped/Processed_Images_${req.params.uuid}.zip`);
})



function checkJobQueue(req, res, uuid, imgsArray) {
    // If the JOB_QUEUE contains a job
    if (JOB_QUEUE.length !== 0) {
        // Get the job
        let fetchJob = JOB_QUEUE.pop();
        // Run the job
        fetchJob.runJob();
        
        // TODO: Set these up as a promise or something instead of trying to guess the timing on it
        // If the imgsArray contains a single image
        if (imgsArray.length === 1) {
            function redirectAfterProcessed() {
                res.redirect(`/download/${uuid}`)
            }
            // We redirect to the UUID download endpoint after we wait for sharp to process everything
            setTimeout(redirectAfterProcessed, process.env.MOD_SINGLE+5);
            
            function cleanUP() {
                fs.rmSync(`./tmp/Jobs/${uuid}`, {recursive: true, force: true});
            }
            setTimeout(cleanUP, process.env.RM_Timeout);
        
        // If multiple images have been uploaded
        } else {
            function redirectAfterProcessed() {
                res.redirect(`/download/${uuid}`)
            }
            // Wait for the sharp-processor to finish the job (plus a delay of 5ms to ensure the zip is ready) and redirect to the UUID download endpoint
            setTimeout(redirectAfterProcessed, imgsArray.length*process.env.MOD_BATCH+5);
            
            function cleanUP() {
                fs.rmSync(`./tmp/Jobs/${uuid}`, {recursive: true, force: true});
            }
            // Remove the job after a specified amount of time should be enough time for the zip file to download
            setTimeout(cleanUP, process.env.RM_Timeout);
        }
    }
}

module.exports = app;