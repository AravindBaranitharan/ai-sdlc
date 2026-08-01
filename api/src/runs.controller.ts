import { Body, Controller, Get, MessageEvent, Param, Patch, Post, Sse } from "@nestjs/common";
import { Observable } from "rxjs";
import { CreatePersonaDto, CreateRunDto, ReviewFindingDto } from "./run.dto";
import { RunsService } from "./runs.service";

@Controller()
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Get("health")
  health() {
    return this.runsService.health();
  }

  @Get("overview")
  overview() {
    return this.runsService.overview();
  }

  @Get("personas")
  personas() {
    return this.runsService.personas();
  }

  @Post("personas")
  createPersona(@Body() dto: CreatePersonaDto) {
    return this.runsService.createPersona(dto);
  }

  @Get("runs")
  runs() {
    return this.runsService.runs();
  }

  @Get("runs/:id")
  run(@Param("id") id: string) {
    return this.runsService.run(id);
  }

  @Post("runs")
  create(@Body() dto: CreateRunDto) {
    return this.runsService.create(dto);
  }

  @Post("runs/:id/start")
  start(@Param("id") id: string) {
    return this.runsService.start(id);
  }

  @Patch("runs/:runId/findings/:findingId")
  reviewFinding(
    @Param("runId") runId: string,
    @Param("findingId") findingId: string,
    @Body() dto: ReviewFindingDto,
  ) {
    return this.runsService.reviewFinding(runId, findingId, dto);
  }

  @Post("runs/:id/tickets")
  createTickets(@Param("id") id: string) {
    return this.runsService.createTickets(id);
  }

  @Sse("runs/:id/events")
  events(@Param("id") id: string): Observable<MessageEvent> {
    return this.runsService.events(id);
  }
}
