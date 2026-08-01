import { Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { RunsController } from "./runs.controller";
import { RunsService } from "./runs.service";

@Module({
  controllers: [RunsController],
  providers: [PrismaService, RunsService],
})
export class AppModule {}
