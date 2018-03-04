// Copyright Jon Williams 2017-2018. See LICENSE file.
const fs = require('fs');
const path = require('path');
const Storage = require('@google-cloud/storage');

class DeployGoogleCloudStorage {
  constructor(app) {
    this.name = app.package(true).name;
    this.project = process.env.GOOGLE_CLOUD_PROJECT;

    this.publicPath = app.publicPath;
    this.sourceDirectory = path.join(app.buildPath, app.publicPath);
    this.calculateBucketName();
  }

  calculateBucketName() {
    const errors = [];
    if (!this.name) errors.push('No name value is defined in your project package.json');
    if (!this.project) {
      errors.push('No project is defined in the GOOGLE_CLOUD_PROJECT environment variable.');
    }
    if (errors.length > 0) {
      errors.push('This is required for cater-deploy-google-cloud-storage.');
      throw new Error(errors.join(' '));
    }

    this.bucketName = `${this.project}-${this.name}`;
    this.bucketUrl = `gs://${this.bucketName}`;
    return this.bucketName;
  }

  calculateUploadList() {
    const files = fs
      .readdirSync(this.sourceDirectory)
      .filter((name) => {
        const file = path.join(this.sourceDirectory, name);
        const stat = fs.statSync(file);
        return stat.isFile();
      })
      .filter((file) => {
        const ext = path.extname(file);
        return ext !== '.gz';
      });
    return files;
  }

  deploying() {
    const files = this.calculateUploadList();
    if (files.length === 0) return null;

    // Creates a list of local paths to remote ones
    const destinations = files.reduce((prev, curr) => {
      const source = path.join(this.sourceDirectory, curr);
      const target = path.join(this.publicPath, curr);
      prev.push([source, target]);
      if (curr === 'favicon.ico') prev.push([source, 'favicon.ico']);
      return prev;
    }, []);

    // Upload options
    const options = {
      gzip: true,
      metadata: { cacheControl: 'public, max-age=31536000' }
    };

    const storage = Storage();
    const storageBucket = storage.bucket(this.bucketName);

    const result = storageBucket
      .exists(this.bucketName)
      .then((data) => {
        const exists = data[0];
        return exists ? [storageBucket] : storageBucket.create();
      })
      .then(([bucket]) => {
        const promises = destinations.map(([source, destination]) => {
          const file = bucket.file(destination);
          return file.exists().then((data) => {
            if (data[0]) return file;
            return bucket.upload(source, { destination, ...options });
          });
        });
        return Promise.all(promises);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to upload files to Google Cloud Storage bucket');
        throw err; // TODO
      });

    return result;
  }
}

module.exports = (app) => new DeployGoogleCloudStorage(app);