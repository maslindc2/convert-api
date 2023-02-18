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
fs.emptyDir('./Jobs');

// TODO: Remove qc folder and set it up as a download
fs.emptyDir('./qc');

// Start listening for requests on assigned port
app.listen(process.env.PORT, () => {
    console.log(`Listening on PORT ${process.env.PORT}`);
});

// This is where we will store pending jobs
var JOB_QUEUE=[];

// Upload endpoint
app.post('/upload', async function(req, res) {
    
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
    checkJobQueue();
});

function checkJobQueue() {
    // If the JOB_QUEUE contains a job
    if (JOB_QUEUE.length !== 0) {
        // Get the job
        let fetchJob = JOB_QUEUE.pop();
        // Run the job
        fetchJob.runJob();
    }
}