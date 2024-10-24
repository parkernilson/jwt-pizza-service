import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from 'aws-cdk-lib/aws-logs'
import { Construct } from "constructs";

export class JwtPizzaServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const domainName = "pizza-service.parkernilson.dev";
    const accountId = cdk.Stack.of(this).account;
    const githubUsername = "parkernilson";
    const githubRepoName = "jwt-pizza-service";

    const pizzaServiceClusterName = "jwt-pizza-service";
    const pizzaServiceServiceName = "jwt-pizza-service";

    // Create VPC with both public and private subnets
    const vpc = new ec2.Vpc(this, "JwtPizzaVpc", {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // Create security group for the pizza service
    const pizzaServiceSg = new ec2.SecurityGroup(this, "JwtPizzaServiceSg", {
      vpc,
      description: "JWT Pizza Service",
      allowAllOutbound: true,
    });

    pizzaServiceSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP traffic"
    );

    pizzaServiceSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS traffic"
    );

    // Create security group for the database
    const dbSg = new ec2.SecurityGroup(this, "JwtPizzaDbSg", {
      vpc,
      description: "JWT Pizza Service Database",
      allowAllOutbound: false,
    });

    dbSg.addIngressRule(
      pizzaServiceSg,
      ec2.Port.tcp(3306),
      "Allow MySQL traffic from Pizza Service"
    );

    const githubActionsRole = new iam.Role(
      this,
      "PizzaServiceGitHubActionsRole",
      {
        assumedBy: new iam.WebIdentityPrincipal(
          `arn:aws:iam::${accountId}:oidc-provider/token.actions.githubusercontent.com`,
          {
            StringEquals: {
              "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
              "token.actions.githubusercontent.com:sub": `repo:${githubUsername}/${githubRepoName}:ref:refs/heads/main`,
            },
          }
        ),
        description: "Role for GitHub Actions to ECR and ECS",
      }
    );

    // Add ECR permissions
    githubActionsRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "PushToECR",
        effect: iam.Effect.ALLOW,
        actions: ["ecr:*"],
        resources: ["*"],
      })
    );

    // Add ECS Task Definition permissions
    githubActionsRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "RegisterTaskDefinition",
        effect: iam.Effect.ALLOW,
        actions: ["ecs:DescribeTaskDefinition", "ecs:RegisterTaskDefinition"],
        resources: ["*"],
      })
    );

    // Add ECS Service deployment permissions
    githubActionsRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "DeployService",
        effect: iam.Effect.ALLOW,
        actions: ["ecs:UpdateService", "ecs:DescribeServices"],
        resources: [
          `arn:aws:ecs:us-east-1:${accountId}:service/jwt-pizza-service/jwt-pizza-service`,
        ],
      })
    );

    // Create RDS MySQL instance
    const dbInstance = new rds.DatabaseInstance(this, "JwtPizzaDb", {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.MICRO
      ),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSg],
      databaseName: "pizza",
      instanceIdentifier: "jwt-pizza-service-db",
      credentials: rds.Credentials.fromGeneratedSecret("admin", {
        excludeCharacters: '"@/\\\'[]{}:,+%~`$&*?|><;=()!#^-.'
      }),
      publiclyAccessible: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });

    // Create an ECR repository
    const repository = new ecr.Repository(this, "JwtPizzaServiceECR", {
      repositoryName: "jwt-pizza-service",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE, // Allow overwriting of tags
      lifecycleRules: [
        {
          tagStatus: ecr.TagStatus.UNTAGGED,
          maxImageAge: cdk.Duration.days(1),
          rulePriority: 1,
        },
      ],
    });

    // Create ECS Task Execution Role
    const taskExecutionRole = new iam.Role(this, "EcsTaskExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description:
        "Role that the Amazon ECS container agent and the Docker daemon can assume",
    });

    // Add managed policy for ECS task execution
    taskExecutionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AmazonECSTaskExecutionRolePolicy"
      )
    );

    // Add policy to allow pulling images from ECR
    taskExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
        ],
        resources: ["*"],
      })
    );

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "JwtPizzaServiceTaskDef",
      {
        family: "jwt-pizza-service",
        cpu: 512, // 0.5 vCPU
        memoryLimitMiB: 1024, // 1 GB
        runtimePlatform: {
          cpuArchitecture: ecs.CpuArchitecture.ARM64,
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        },
        executionRole: taskExecutionRole,
        // taskRole: // TODO: add task role here if we want to give task access to db without using explicit credentials
      }
    );

    // Add IAM Pass Role permissions so that GithubActionsRole can pass the TaskExecution role for deployment
    githubActionsRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "PassRolesInTaskDefinition",
        effect: iam.Effect.ALLOW,
        actions: ["iam:PassRole"],
        resources: [taskExecutionRole.roleArn, taskDefinition.taskRole.roleArn],
      })
    );

    // Create a log group for the ECS task
    const logGroup = new ecs.AwsLogDriver({
      streamPrefix: "jwt-pizza-service",
      logGroup: new logs.LogGroup(this, "JwtPizzaServiceLogGroup", {
        logGroupName: "/ecs/jwt-pizza-service",
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });

    taskDefinition.addContainer("jwt-pizza-service", {
      image: ecs.ContainerImage.fromEcrRepository(repository, "latest"),
      portMappings: [{ containerPort: 80 }],
      logging: logGroup
    });

    // Create ECS Cluster
    const cluster = new ecs.Cluster(this, "JwtPizzaServiceCluster", {
      vpc,
      clusterName: pizzaServiceClusterName,
    });

    // Create ECS Service
    const ecsService = new ecs.FargateService(this, "JwtPizzaServiceService", {
      cluster,
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: false,
      serviceName: pizzaServiceServiceName,
      securityGroups: [pizzaServiceSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }
    });

    // Create a new certificate
    const certificate = new acm.Certificate(this, "Certificate", {
      domainName: domainName,
      validation: acm.CertificateValidation.fromDns(),
    });

    // Create Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, "MyALB", {
      vpc,
      internetFacing: true,
    });

    // Add HTTPS listener to ALB
    const httpsListener = alb.addListener("HttpsListener", {
      port: 443,
      certificates: [certificate],
    });

    // Add targets to HTTPS listener
    httpsListener.addTargets("ECS", {
      port: 80,
      targets: [ecsService],
      healthCheck: {
        path: "/api/docs",
        interval: cdk.Duration.seconds(60),
      },
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    // Redirect HTTP to HTTPS
    alb.addRedirect({
      sourceProtocol: elbv2.ApplicationProtocol.HTTP,
      sourcePort: 80,
      targetProtocol: elbv2.ApplicationProtocol.HTTPS,
      targetPort: 443,
    });

    // Allow ALB to access ECS Service
    ecsService.connections.allowFrom(alb, ec2.Port.tcp(80));

    // Output the repository URI
    new cdk.CfnOutput(this, "RepositoryUri", {
      value: repository.repositoryUri,
      description: "The URI of the ECR repository",
    });

    // Output the database endpoint
    new cdk.CfnOutput(this, "DbEndpoint", {
      value: dbInstance.dbInstanceEndpointAddress,
      description: "Database Endpoint",
    });

    // Output the secret name for database credentials
    new cdk.CfnOutput(this, "DbSecretName", {
      value: dbInstance.secret?.secretName || "No secret created",
      description: "Database Credentials Secret Name",
    });
  }
}
