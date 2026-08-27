import { Module } from "@nestjs/common";
import { OpenAiUxService } from "./openai-ux.service";
import { PrismaService } from "./prisma.service";
import { RunsController } from "./runs.controller";
import { RunsService } from "./runs.service";

@Module({
  controllers: [RunsController],
  providers: [PrismaService, OpenAiUxService, RunsService],
})
export class AppModule {}
