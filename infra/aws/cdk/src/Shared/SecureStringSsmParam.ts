import {Arn, ArnFormat, Stack} from "aws-cdk-lib";
import {Construct} from "constructs";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId
} from "aws-cdk-lib/custom-resources";
import {PolicyStatement} from "aws-cdk-lib/aws-iam";

/**
 * The construct intentionally doesn't take a value to store in the param,
 * because I don't want to accidentally be slinging around secrets.  The
 * intended use case for this construct is that you `deploy` the code, then
 * update the param manually in the console.
 * Yes, that means your infra that depends on these values (DB connections,
 * API keys, etc.) won't work until you take that manual action.
 * Usually, when I first create the dependant services (ECS etc.),
 * I configure the CDK to "create" the service but not run it (i.e. the ECS task
 * definition desiredCount is initially "0") until I have a chance to go and
 * manually populate the secrets.
 *
 * Note that this intentionally fails if a param with that name already exists.
 * This means that the param creation may fail if you just change the id without
 * changing the name, depending on the order that CDK does the operations in.
 * Also note that the AwsCustomResource uses the parameter name in the
 * security policy, so if you change the param name - you might run into
 * permission errors.  Best to just delete then re-create.
 * @see validateParameterName
 */
export class SecureStringSsmParam extends Construct {
  readonly parameterName: string;
  readonly resource: AwsCustomResource;
  readonly arn: string;

  constructor(scope: Construct, id: string, parameterName: string) {
    super(scope, id);
    validateParameterName(parameterName);
    this.parameterName = parameterName;

    this.arn = Arn.format({
      service: 'ssm',
      resource: 'parameter',
      // the leading slash seems to cause policy problems
      resourceName: this.parameterName.startsWith('/') ?
        this.parameterName.substring(1) : this.parameterName,
      // this is the format used by policy-statement-resources
      arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
    }, Stack.of(this));

    this.resource = new AwsCustomResource(this, 'CustomResource', {
      onCreate: {
        service: 'SSM',
        action: 'putParameter',
        parameters: {
          Name: this.parameterName,
          Type: 'SecureString',
          Value: 'set me via console',
          Overwrite: false,
        },
        physicalResourceId: PhysicalResourceId.of(this.parameterName),
      },
      onDelete: {
        service: 'SSM',
        action: 'deleteParameter',
        parameters: {
          Name: this.parameterName,
        },
      },
      policy: AwsCustomResourcePolicy.fromStatements([
        new PolicyStatement({
          actions: ['ssm:PutParameter', 'ssm:DeleteParameter'],
          resources: [this.arn],
        }),
      ]),
    });

  }

}

/**
 * Allowed: 'name', '/name/name'
 * Disallowed: '/name", 'name/name', falsy, ' '
 */
function validateParameterName(parameterName: string): boolean {
  if (!parameterName || parameterName.trim() === '') {
    throw new Error('Parameter name cannot be empty or blank.');
  }

  /* AWS treats names that have one starting slash as special (they remove the
  slash for some reason).
  The construct could be made to work with a leading slash, but I then I'd
  have to remember what was going on later, I'd rather have the code remind
  me when I do this - so I can just change the name to be "flat". */
  if (parameterName.startsWith('/') && parameterName.lastIndexOf('/') === 0) {
    throw new Error('Parameter name must not start with a single slash.' +
      ' It must either contain no leading slash or additional' +
      ' slashes within the name.');
  }

  // Param creation fails on names like 'testSecureString/nameD'
  if (!parameterName.startsWith('/') && parameterName.includes('/')) {
    throw new Error('Parameter name must not contain slashes unless it starts' +
      ' with a slash and has additional slashes within the name.');
  }

  // chatgpt wrote this, dunno if it's true
  if (parameterName.length > 256) {
    throw new Error('Parameter name cannot be longer than 256 characters.');
  }

  return true;
}