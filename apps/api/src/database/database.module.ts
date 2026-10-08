import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { loadApiEnvironment } from '@zapx/config';
import {
  ApiKeyRepository,
  AuditRepository,
  ConsoleRepository,
  DatabasePool,
  DeliveryRepository,
  IdentityRepository,
  NotificationRepository,
  ProviderRepository,
  TemplateRepository,
} from '@zapx/database';

@Global()
@Module({
  exports: [
    DatabasePool,
    IdentityRepository,
    ApiKeyRepository,
    AuditRepository,
    ConsoleRepository,
    NotificationRepository,
    DeliveryRepository,
    ProviderRepository,
    TemplateRepository,
  ],
  providers: [
    {
      provide: DatabasePool,
      useFactory: () => new DatabasePool(loadApiEnvironment().DATABASE_URL),
    },
    {
      provide: IdentityRepository,
      useFactory: (database: DatabasePool) => new IdentityRepository(database),
      inject: [DatabasePool],
    },
    {
      provide: ApiKeyRepository,
      useFactory: (database: DatabasePool) => new ApiKeyRepository(database),
      inject: [DatabasePool],
    },
    {
      provide: AuditRepository,
      useFactory: (database: DatabasePool) => new AuditRepository(database),
      inject: [DatabasePool],
    },
    {
      provide: NotificationRepository,
      useFactory: (database: DatabasePool) => new NotificationRepository(database),
      inject: [DatabasePool],
    },
    {
      provide: DeliveryRepository,
      useFactory: (database: DatabasePool) => new DeliveryRepository(database),
      inject: [DatabasePool],
    },
    {
      provide: ConsoleRepository,
      useFactory: (database: DatabasePool) => new ConsoleRepository(database),
      inject: [DatabasePool],
    },
    {
      provide: ProviderRepository,
      useFactory: (database: DatabasePool) => new ProviderRepository(database),
      inject: [DatabasePool],
    },
    {
      provide: TemplateRepository,
      useFactory: (database: DatabasePool) => new TemplateRepository(database),
      inject: [DatabasePool],
    },
  ],
})
export class DatabaseModule implements OnApplicationShutdown {
  public constructor(private readonly database: DatabasePool) {}

  public async onApplicationShutdown(): Promise<void> {
    await this.database.close();
  }
}
