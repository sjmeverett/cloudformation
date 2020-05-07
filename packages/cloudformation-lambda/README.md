# @sjmeverett/cloudformation-lambda

Functions to generate CloudFormation for common Lambda setups.

For use in conjunction with [@sjmeverett/cloudformation-types](https://npmjs.com/package/@sjmeverett/cloudformation-types).

## `createLogPolicy(name: string): IAMRolePolicy`

Convenience function to create a IAM policy document which allows logging in CloudWatch. Returns:

```js
{
  PolicyName: name,
  PolicyDocument: {
    Version: "2012-10-17",
    Statement: [
      {
        Action: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        Resource: "arn:aws:logs:*:*:*",
        Effect: "Allow",
      },
    ],
  },
}
```

## `createLambdaRole(name: string, options: CreateLambdaRoleOptions)`

Convenience function to assemble an IAM Role for Lambda.

## `createLambdaFnWithRole(name: string, options: CreateLambdaFnWithRoleOptions)`

Creates a lambda function with the specified role options.
