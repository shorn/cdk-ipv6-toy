import {Construct} from "constructs";
import {ReadWriteType, Trail} from "aws-cdk-lib/aws-cloudtrail";

export class CloudTrail extends Construct {

  constructor(scope: Construct, id: string,){
    super(scope, id);

    new Trail(this, 'ManagementEvents', {
      includeGlobalServiceEvents: true,
      managementEvents: ReadWriteType.ALL,
      enableFileValidation: true,
      // default is false, disabled for cost minimisation
      sendToCloudWatchLogs: false,
      // disabled by default - if you want to enable, document your threat model
      encryptionKey: undefined,
      // let AWS auto-generate
      trailName: undefined,
      /* let AWS auto-generate, including permissions
      It will be created as RETAIN, which is fine. */
      bucket: undefined,
      // this can only be true for the management account
      isOrganizationTrail: false,
    });
    
  }
}