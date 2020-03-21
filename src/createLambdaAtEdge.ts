import {
  createIAMRole,
  createLambdaFunction,
  createLambdaVersion,
} from './generated';
import { createModule } from './createModule';

export interface LambdaAtEdgeOptions {
  Code: string;
  Runtime?: string;
}

export function createLambdaAtEdge(name: string, options: LambdaAtEdgeOptions) {
  const role = createIAMRole(name + 'Role', {
    AssumeRolePolicyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Service: ['lambda.amazonaws.com', 'edgelambda.amazonaws.com'],
          },
          Action: 'sts:AssumeRole',
        },
      ],
    },
    ManagedPolicyArns: [
      'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
    ],
  });

  const lambda = createLambdaFunction(name, {
    Code: {
      ZipFile: options.Code,
    },
    Handler: 'index.handler',
    Role: role.attributes.Arn,
    Runtime: options.Runtime || 'nodejs10.x',
  });

  const lambdaVersion = createLambdaVersion(name + 'Version', {
    FunctionName: lambda.ref,
  });

  return createModule(
    name,
    { role, lambda, lambdaVersion },
    { Arn: lambdaVersion.ref },
  );
}

export const staticSiteRewriteSource = `
'use strict';
const regex = /\\.[a-z0-9]+$/;
const indexDocument = 'index.html';

exports.handler = (event, context, cb) =>{
  const cf = event.Records[0].cf;
  const config = cf.config;
  const request = cf.request;

  if (request.uri.endsWith('/')) {
    // rewrite /foo/bar/ to /foo/bar/index.html
    cb(null, Object.assign({}, request, {uri: request.uri + indexDocument}));
  } else if (request.uri.endsWith('/' + indexDocument)) {
    // redirect /foo/bar/index.html to /foo/bar/ (for SEO)
    cb(null, {
      status: '302',
      statusDescription: 'Found',
      headers: {
        location: [{
          key: 'Location',
          value: request.uri.substr(0, request.uri.length - indexDocument.length),
        }],
      }
    });
  } else if (!regex.test(request.uri)) {
    // redirect /foo to /foo/
    cb(null, {
      status: '302',
      statusDescription: 'Found',
      headers: {
        location: [{
          key: 'Location',
          value: request.uri + '/',
        }],
      }
    });
  } else {
    cb(null, request);
  }
}
`;

export const html5HistoryApiSource = `
'use strict';
const regex = /\\.[a-z0-9]+$/;
const indexDocument = '/index.html';

exports.handler = (event, context, cb) =>{
  const cf = event.Records[0].cf;
  const config = cf.config;
  const request = cf.request;

  if (!regex.test(request.uri)) {
    // rewrite non-file requests to /index.html
    cb(null, Object.assign({}, request, {uri: indexDocument}));
  } else {
    cb(null, request);
  }
}
`;
