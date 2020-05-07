require("dotenv").config();

const config = {
  backupFolder: "backups"
};

const AWS = require("aws-sdk");
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_ACCESS_KEY_SECRET
});

const fs = require("fs");
const glob = require("glob");
const puppeteer = require("puppeteer");

async function waitAndClick(page, selector) {
  await page.waitForSelector(selector);
  await page.click(selector);
}

const generateExport = async () => {
  const browser = await puppeteer.launch();
    // {
    //   args: ['--remote-debugging-port=9222']
    // })
  const page = await browser.newPage();
  try {
    await page._client.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: process.cwd()
    });

    await page.goto("https://roamresearch.com/#/signin");
    console.log("Logging into Roam");
    await page.focus('[name="email"]');
    await page.keyboard.type(process.env.ROAM_EMAIL);
    await page.focus('[name="password"]');
    await page.keyboard.type(process.env.ROAM_PASSWORD);
    await page.$eval(".bp3-button", el => el.click());

    await page.waitFor(5000);

    console.log("Successfully logged in");
    await waitAndClick(page, ".flex-h-box > div > .bp3-popover-wrapper > .bp3-popover-target > .bp3-small"); // Options menu
    console.log("Opening Export menu");
    await waitAndClick(page, ".bp3-popover-content > .bp3-menu > li:nth-child(3) > .bp3-menu-item > .bp3-text-overflow-ellipsis"); // "Export" list item
    // await waitAndClick(page, ".bp3-popover-wrapper > .bp3-popover-target > div > .bp3-button > .bp3-button-text") // "Markdown"
    // console.log("Selecting JSON export");
    // await waitAndClick(page, "div > .bp3-menu > li > .bp3-menu-item > .bp3-text-overflow-ellipsis") // "JSON"
    // console.log("Waiting for switch to JSON format")
    // // await page.waitFor(5000);
    console.log("Creating export");
    await waitAndClick(page, ".bp3-dialog-container > .bp3-dialog > div > .flex-h-box > .bp3-intent-primary") // "Export" button
    console.log("Waiting 15 seconds for it to download");
    await page.waitFor(15000);
  } catch (err) {
    console.error("Something went wrong!");
    console.error(err);

    await page.screenshot({path: "error.png"});
  }
  await browser.close();
};

const uploadToS3 = async filename => {
  try {
    const fileContent = fs.readFileSync(filename);

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `${config.backupFolder}/${filename}`,
      Body: fileContent
    };

    const data = await s3.upload(params).promise();
    console.log(`Successfully backed up Roam data to S3: ${data.Location}`);
  } catch (err) {
    console.error("Something went wrong while uploading to S3");
    console.error(err);
  }
};

const main = async function () {
  await generateExport();
  const files = glob.sync("*.zip");
  const filename = files[0];
  if (!filename) {
    throw new Error("Couldn't find a file to upload, aborting");
  }
//   console.log(`Uploading ${filename} to S3`);
//   await uploadToS3(filename);
};

main();
