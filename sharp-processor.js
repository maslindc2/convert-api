require('dotenv').config();
const fs = require('fs-extra');
const sharp  = require('sharp');
const AdmZip = require('adm-zip');

class Job{
    constructor(uuid, req, imgs){
        this.uuid = uuid;
        this.req = req;
        this.imgs = imgs;
    }

    runJob(){
        let user = this.uuid;
        let request = this.req;
        let imgArray = this.imgs;

        //Create a folder using the UUID, setup processed, uploaded, and zipped folders
        fs.emptyDir(`./Jobs/${user}`)
        fs.emptyDir(`./Jobs/${user}/processed`);
        fs.emptyDir(`./Jobs/${user}/uploaded`);
        fs.emptyDir(`./Jobs/${user}/zipped`);

        /**
         * Process the image(s) that were uploaded using the imgArray
         * - First define our upload and processing folders
         * - Store the uploaded images into the uploaded folder
         * - Check if were are converting or resizing
         *      - If we are converting set the output file name (using the uploaded file name) and extension (using the requested file extension)
         *          - If the image extension is the same as the original no need to convert it simply move it to the processed folder
         *        Lastly convert the image using sharp
         *      - If we are resizing use the original file name and extension, resize the image(s)
         */
        function processImages() {
            imgArray.forEach(uploadedImg => {
                // File path for the uploaded file using the original file name
                let uploadedFilePath = `./Jobs/${user}/uploaded/` + uploadedImg.name;
                // File path for the processed file
                let processedFilePath = `./Jobs/${user}/processed/`;

                //Store the uploaded image to the uploaded folder
                uploadedImg.mv(uploadedFilePath, function(){
                    //If convert was selected run the convert modes for sharp
                    if(request.body.function === 'convert'){
                        // Check to see if the converted to file extension is the same thing (ie: User uploads a .jpg, user wants to convert it to a .jpg), there is no need to convert it so move it to processed
                        if(request.body.fileExt === uploadedImg.name.split('.'[1])){
                            fs.moveSync(uploadedFilePath, processedFilePath + uploadedImg.name);
                        
                        // Set the new (converted to) file extension for the uploaded image
                        }else{
                            // Split the uploaded file name into [file name, file ext] get the name and append the converted extension to it
                            let convertedFileName = uploadedImg.name.split('.')[0] + '.' + request.body.fileExt;
                            // Add the new file name to the processed path
                            processedFilePath += convertedFileName;
                            // Run the conversion function
                            convert(request, uploadedFilePath, processedFilePath);
                        }
                    }

                    // If resize mode was selected
                    if(request.body.function === 'resize')
                        // Simply run the resize mode
                        resize(request, uploadedFilePath, processedFilePath + uploadedImg.name);
                });
            });
        }
        //Wait ___ ms for the folders to be created 
        // TODO: Adjust the timing and someday when I learn JS switch it out to callbacks or async's
        setTimeout(processImages, 80);

        /**
         * Convert the image using Sharp,  Jpeg conversion is set to highest quality jpeg, PNG by default is lossless, Webp is compressed and uses highest CPU setting
         * @param {*} req contains the request from the frontend. Used for determining what to convert the uploaded file to
         * @param {*} uploadedFilePath contains the location of the uploaded file
         * @param {*} processedFilePath where the processed file should be stored
         */
        function convert(req, uploadedFilePath, processedFilePath) {
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
            }
        }

        /**
         * Resize the image using Sharp,  Resizing is done using the default fill mode, process avoids any weird stretching/scaling problems
         * @param {*} req contains the request from the frontend. Used for determining what resolution to resize the image to 
         * @param {*} uploadedFilePath contains the location of the uploaded file
         * @param {*} processedFilePath where the processed file should be stored
         */
        function resize(req, uploadedFilePath, processedFilePath) {
            sharp(uploadedFilePath)
                //Resize input file and write it to export path
                .resize(parseInt(req.body.width), parseInt(req.body.height))
                .toFile(processedFilePath)
                .then(() => {
                    //remove the uploaded file from uploaded folder 
                    fs.removeSync(uploadedFilePath)
                })
        }

        // After we are done processing the uploaded image zip it up and store it in the zipped folder
        // TODO: If a single image is uploaded no need to zip it up just send it out
        function zipProcessed(){
            // initialize AdamZip
            const zip = new AdmZip();

            const outputFile = `./Jobs/${user}/zipped/Processed_Images_${user}.zip`;
            
            //Add the processed image(s) to the zip
            zip.addLocalFolder(`./Jobs/${user}/processed`);
            zip.writeZip(outputFile);

            //Clean out processed and zipped directories
            fs.emptyDir(`./Jobs/${user}/processed`);
        }

        //If imgs array contains one image we need to set the appropriate amount of time to wait until it has been zipped up
        if (imgArray.length === 1) {
            setTimeout(zipProcessed, process.env.MOD_SINGLE);
        } else {
            //delay the start of zip operation by length of imgArray * modifier (num of ms it takes on avg to process an img)
            setTimeout(zipProcessed, imgArray.length*process.env.MOD_BATCH);
        }
    }
}

module.exports = Job