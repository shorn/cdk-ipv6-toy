import {IpAddresses} from 'aws-cdk-lib/aws-ec2';

export const aws = {
  ciRegion: 'us-east-1',
  
  // cloudfront only supports us-east-1 for certificates
  cloudfrontRegion: 'us-east-1',
}

export const github = {
  // manually created in github
  owner: 'shorn', repoName: 'cdk-ipv6-toy',
}

