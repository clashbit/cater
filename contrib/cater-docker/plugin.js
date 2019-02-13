// Copyright Jon Williams 2017-2018. See LICENSE file.

const dockerfileTemplate = `FROM node:alpine

RUN mkdir -p /usr/src/app/build
WORKDIR /usr/src/app

COPY package.json /usr/src/app/
COPY yarn.lock /usr/src/app/
RUN yarn install --production

COPY . /usr/src/app/build

ENV NODE_ENV production
EXPOSE 3000
CMD [ "npm", "start" ]`;

const dockerignoreTemplete = `node_modules
`;

class DockerPlugin {
  building(app, build) {
    build.copy('package.json');
    build.copy('yarn.lock');
    build.emit('Dockerfile', dockerfileTemplate);
    build.emit('.dockerignore', dockerignoreTemplete);

    // Attempt to resolve the docker tag. This will default to
    // DOCKER_ID_USER/package-name:package-version for projects marked
    // public in package.json. Otherwise we look for dockerName in the
    // package.json
    const pkg = app.package(true);
    let tag = '';
    if (process.env.DOCKER_ID_USER && !pkg.private) {
      tag = `${process.env.DOCKER_ID_USER}/${pkg.name}:${pkg.version}`;
    }
    if (pkg.dockerName) tag = `${pkg.dockerName}:${pkg.version}`;

    if (tag) {
      build.emitConfigurationFile('cater-docker', { docker: { tag } });
      this.tag = tag;
    }
  }

  built(app, build) {
    const command = [`cd ${app.buildPath} &&`, 'docker build .'];
    if (this.tag) command.push(`--tag ${this.tag}`);

    build.exec(command.join(' '));
  }
}

module.exports = (app) => new DockerPlugin(app);
