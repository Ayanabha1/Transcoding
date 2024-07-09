const util = require("util");
const fs = require("fs");
const AWS = require("aws-sdk");
const { exec } = require("child_process");
const path = require("path");
require("dotenv").config();

const transcode720p = "720p.sh",
  transcode480p = "480p.sh",
  transcode360p = "360p.sh";

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

const localFilePath = process.env.LOCAL_FILE_PATH;

const getObjectPromise = util.promisify(s3.getObject.bind(s3));
const writeFilePromise = util.promisify(fs.writeFile);

const video_path = process.env.LOCAL_FILE_PATH;
const transcode_path = "./transcoded_videos";
const folderPath = "./transcoded_videos";
const targetFolder = process.env.TARGET_FOLDER;
const outputBucketName = process.env.OUTPUT_BUCKET_NAME;

// Upload Transcoded Files
const uploadFileToS3 = async (filePath, key) => {
  const fileContent = fs.readFileSync(filePath);
  const params = {
    Bucket: outputBucketName,
    Key: key,
    Body: fileContent,
  };

  try {
    await s3.upload(params).promise();
    console.log(`Uploaded file: ${key}`);
  } catch (error) {
    console.error(`Error uploading file ${key}:`, error);
  }
};

const uploadFolder = async () => {
  try {
    const files = fs.readdirSync(folderPath);
    const masterFilePath = "master.m3u8";
    const masterFileKey = `${targetFolder}/master.m3u8`;
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const key = `${targetFolder}/${file}`;
      await uploadFileToS3(filePath, key);
    }
    await uploadFileToS3(masterFilePath, masterFileKey);
  } catch (error) {
    console.log(error);
    console.log("ERROR IN UPLOADING");
  }
};

// Transcode Video
const transcoder = async (shell) => {
  return new Promise((res, rej) => {
    console.log("Transcoding using", shell);
    exec(
      `bash ${shell} ${video_path} ${transcode_path}`,
      (error, stdout, stderr) => {
        if (error) {
          console.log(error);
          rej("Transcoding failed");
        }
        res("Transcoding success");
      }
    );
  });
};

const transcodeVideo = async () => {
  try {
    console.log("Transcoding starts");
    const startTime = process.hrtime();

    const promises = [
      transcoder(transcode720p),
      transcoder(transcode480p),
      transcoder(transcode360p),
    ];

    await Promise.all(promises);
    console.log("Transcoding ends");

    const endTime = process.hrtime(startTime);
    const timeTakenSeconds = endTime[0] + endTime[1] / 1e9;

    console.log(
      `Transcoding completed in ${timeTakenSeconds.toFixed(2)} seconds.`
    );
    console.log("Uploading to s3");
    await uploadFolder();
    console.log("Uploading completed");
    console.log("Container stops at:", Date.now());
  } catch (error) {
    console.log(error);
    throw new Error("Could not transcode");
  }
};

// Download Video
const downloadVideo = async () => {
  try {
    console.log("Container starts at:", Date.now());
    // Download the video file from S3
    const params = {
      Bucket: process.env.INPUT_BUCKET_NAME,
      Key: process.env.S3_VIDEO_KEY,
    };
    const { Body } = await getObjectPromise(params);

    // Save the downloaded video to local file
    await writeFilePromise(localFilePath, Body);

    console.log("Video downloaded successfully and saved to:", localFilePath);
    transcodeVideo();
  } catch (error) {
    console.error("Error downloading or saving video:", error);
  }
};

downloadVideo();
