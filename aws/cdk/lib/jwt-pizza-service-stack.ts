import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export class JwtPizzaServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC with both public and private subnets
    const vpc = new ec2.Vpc(this, 'JwtPizzaVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });


    // Create security group for the pizza service
    const pizzaServiceSg = new ec2.SecurityGroup(this, 'JwtPizzaServiceSg', {
      vpc,
      description: 'JWT Pizza Service',
      allowAllOutbound: true,
    });

    pizzaServiceSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic'
    );

    pizzaServiceSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic'
    );

    // Create security group for the database
    const dbSg = new ec2.SecurityGroup(this, 'JwtPizzaDbSg', {
      vpc,
      description: 'JWT Pizza Service Database',
      allowAllOutbound: false,
    });

    dbSg.addIngressRule(
      pizzaServiceSg,
      ec2.Port.tcp(3306),
      'Allow MySQL traffic from Pizza Service'
    );

    // Create RDS MySQL instance
    const dbInstance = new rds.DatabaseInstance(this, 'JwtPizzaDb', {
      engine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSg],
      databaseName: 'jwt_pizza_service_db',
      instanceIdentifier: 'jwt-pizza-service-db',
      credentials: rds.Credentials.fromGeneratedSecret('admin'),
      publiclyAccessible: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });

    // Output the database endpoint
    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: dbInstance.dbInstanceEndpointAddress,
      description: 'Database Endpoint',
    });

    // Output the secret name for database credentials
    new cdk.CfnOutput(this, 'DbSecretName', {
      value: dbInstance.secret?.secretName || 'No secret created',
      description: 'Database Credentials Secret Name',
    });
  }
}