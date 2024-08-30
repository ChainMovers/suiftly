import * as fs from 'fs';
import * as cron from 'node-cron';
import fetch from 'node-fetch';
import * as path from 'path';
import * as unzipper from 'unzipper';

const DOWNLOAD_URL = 'https://example.com/largefile.zip'; // Replace with your API URL
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
const UNZIP_DIR = path.join(__dirname, 'unzipped');

// Ensure directories exist
if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR);
}
if (!fs.existsSync(UNZIP_DIR)) {
    fs.mkdirSync(UNZIP_DIR);
}

// Function to download the file
async function downloadFile(url: string, outputPath: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download file: ${response.statusText}`);
    const fileStream = fs.createWriteStream(outputPath);
    return await new Promise((resolve, reject) => {
        response.body.pipe(fileStream);
        response.body.on('error', reject);
        fileStream.on('finish', resolve);
    });
}

// Function to unzip the file
async function unzipFile(zipPath: string, outputDir: string): Promise<void> {
    return fs
        .createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: outputDir }))
        .promise();
}

// Function to process the unzipped files
function processFiles(directory: string): void {
    fs.readdir(directory, (err, files) => {
        if (err) throw err;
        files.forEach(file => {
            const filePath = path.join(directory, file);
            console.log(`Processing file: ${filePath}`);
            // Add your file processing logic here
        });
    });
}

// Main function to download, unzip, and process the file
async function main(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipPath = path.join(DOWNLOAD_DIR, `file-${timestamp}.zip`);
    try {
        console.log('Starting download...');
        await downloadFile(DOWNLOAD_URL, zipPath);
        console.log('Download complete. Unzipping...');
        await unzipFile(zipPath, UNZIP_DIR);
        console.log('Unzipping complete. Processing files...');
        processFiles(UNZIP_DIR);
        console.log('Processing complete.');
    } catch (error) {
        console.error('Error:', error);
    }
}

// Schedule the task to run periodically (e.g., every hour)
cron.schedule('0 * * * *', () => {
    console.log('Running scheduled task...');
    main();
});

// Run the main function immediately
main();
