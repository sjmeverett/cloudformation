import {
  createIAMRole,
  IAMRolePolicy,
  LambdaFunctionProperties,
  createLambdaFunction,
  getAttribute,
  LambdaFunctionDescription,
  IAMRoleDescription,
} from "@sjmeverett/cloudformation-types";

export function createLogPolicy(name: string): IAMRolePolicy {
  return {
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
  };
}

export interface CreateLambdaRoleOptions {
  Policies?: IAMRolePolicy[];
  AllowLogging?: boolean;
}

export function createLambdaRole(
  name: string,
  options: CreateLambdaRoleOptions
) {
  const Policies = options.Policies || [];

  if (options.AllowLogging) {
    Policies.push(createLogPolicy(name + "LogPolicy"));
  }

  return createIAMRole(name, {
    AssumeRolePolicyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "sts:AssumeRole",
          Principal: {
            Service: "lambda.amazonaws.com",
          },
          Effect: "Allow",
          Sid: "",
        },
      ],
    },
    Policies,
  });
}

export interface CreateLambdaFnWithRoleOptions
  extends CreateLambdaRoleOptions,
    Omit<LambdaFunctionProperties, "Role"> {}

export function createLambdaFnWithRole(
  name: string,
  options: CreateLambdaFnWithRoleOptions
): [LambdaFunctionDescription, IAMRoleDescription] {
  const { Policies, AllowLogging, ...lambdaOptions } = options;
  const role = createLambdaRole(name + "Role", { Policies, AllowLogging });

  const lambda = createLambdaFunction(name, {
    ...lambdaOptions,
    Role: getAttribute(role, "Arn"),
  });

  return [lambda, role];
}
