// Copyright Jon Williams 2017-2018. See LICENSE file.
import React from 'react';
import Title from 'app/cater/title';

import dockerLogo from './docker.png';

/* A simple (but friendly) React Component */
export default () => (
  <div>
    <Title>Hello Down There!</Title>
    <h1>Hello from Docker!</h1>
    <img alt="Docker Logo" src={dockerLogo} />
  </div>
);
