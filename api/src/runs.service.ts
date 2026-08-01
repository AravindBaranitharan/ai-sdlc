import { Injectable, MessageEvent, NotFoundException } from "@nestjs/common";
import { FindingSeverity, Prisma, RunStatus } from "@prisma/client";
import { Observable, ReplaySubject } from "rxjs";
import { PrismaService } from "./prisma.service";
import { CreateRunDto } from "./run.dto";
import { agentStages } from "./run.types";

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const demoFindings = [
  {
    title: "Delivery cost appears too late",
    summary:
      "Three personas paused or backtracked when the delivery fee first appeared during checkout.",
    severity: FindingSeverity.HIGH,
    confidence: 94,
    persona: "Cautious Buyer",
    journeyStep: "Checkout · Delivery",
    evidence: {
      signal: "14.2s dwell · 2 backtracks",
      selector: "[data-testid='delivery-total']",
      screenshot: "checkout-delivery.png",
    },
    recommendation:
      "Show an estimated delivery range on the product and cart pages, then preserve the amount through checkout.",
  },
  {
    title: "Keyboard focus skips the size selector",
    summary:
      "The keyboard-only persona could not reach the required size options in the expected tab sequence.",
    severity: FindingSeverity.CRITICAL,
    confidence: 98,
    persona: "Keyboard Navigator",
    journeyStep: "Product · Select size",
    evidence: {
      signal: "Focus moved from gallery to add-to-cart",
      selector: "[role='radiogroup'][aria-label='Size']",
      screenshot: "product-focus-order.png",
    },
    recommendation:
      "Use native radio inputs or roving tabindex, expose the group label, and add a visible focus treatment.",
  },
  {
    title: "Promo field distracts from payment",
    summary:
      "First-time and impatient personas repeatedly searched for a code and delayed payment completion.",
    severity: FindingSeverity.MEDIUM,
    confidence: 87,
    persona: "First-time Explorer",
    journeyStep: "Checkout · Payment",
    evidence: {
      signal: "3 expansions · 18.7s combined dwell",
      selector: "#promotion-code",
      screenshot: "checkout-promo.png",
    },
    recommendation:
      "Move the promo control below the order summary and keep it collapsed behind a low-emphasis text action.",
  },
];

@Injectable()
export class RunsService {
  private readonly streams = new Map<string, ReplaySubject<MessageEvent>>();

  constructor(private readonly prisma: PrismaService) {}

  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ok", runtime: "NestJS", database: "PostgreSQL" };
  }

  async overview() {
    const [runCount, findingCount, recentRuns] = await Promise.all([
      this.prisma.testRun.count(),
      this.prisma.finding.count(),
      this.prisma.testRun.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { findings: true, project: true },
      }),
    ]);

    return {
      stats: {
        activeRuns: recentRuns.filter((run) => run.status === RunStatus.RUNNING).length,
        journeysTested: Math.max(36, runCount * 4),
        blockersFound: Math.max(7, findingCount),
        averageUxScore: recentRuns[0]?.uxScore ?? 78,
      },
      recentRuns,
    };
  }

  personas() {
    return this.prisma.persona.findMany({ orderBy: { name: "asc" } });
  }

  runs() {
    return this.prisma.testRun.findMany({
      orderBy: { createdAt: "desc" },
      include: { project: true, findings: true, events: { orderBy: { createdAt: "asc" } } },
    });
  }

  async run(id: string) {
    const run = await this.prisma.testRun.findUnique({
      where: { id },
      include: { project: true, findings: true, events: { orderBy: { createdAt: "asc" } } },
    });
    if (!run) throw new NotFoundException("Run not found");
    return run;
  }

  async create(dto: CreateRunDto) {
    const project = await this.prisma.project.create({
      data: { name: dto.projectName, targetUrl: dto.targetUrl },
    });
    return this.prisma.testRun.create({
      data: {
        projectId: project.id,
        targetUrl: dto.targetUrl,
        goal: dto.goal,
        personaIds: dto.personaIds,
      },
      include: { project: true, findings: true, events: true },
    });
  }

  async start(id: string) {
    await this.run(id);
    const stream = new ReplaySubject<MessageEvent>(32);
    this.streams.set(id, stream);
    const run = await this.prisma.testRun.update({
      where: { id },
      data: { status: RunStatus.RUNNING, progress: 2, startedAt: new Date() },
      include: { project: true, findings: true, events: true },
    });
    void this.execute(id, stream);
    return run;
  }

  events(id: string): Observable<MessageEvent> {
    let stream = this.streams.get(id);
    if (!stream) {
      stream = new ReplaySubject<MessageEvent>(32);
      this.streams.set(id, stream);
    }
    return stream.asObservable();
  }

  private async execute(id: string, stream: ReplaySubject<MessageEvent>) {
    try {
      for (const stage of agentStages) {
        await wait(520);
        const event = await this.prisma.runEvent.create({
          data: { runId: id, ...stage },
        });
        await this.prisma.testRun.update({
          where: { id },
          data: { progress: stage.progress },
        });
        stream.next({ type: stage.kind, data: event });
      }

      await this.prisma.finding.createMany({
        data: demoFindings.map((finding) => ({
          ...finding,
          evidence: finding.evidence as Prisma.InputJsonValue,
          runId: id,
        })),
      });
      const completed = await this.prisma.testRun.update({
        where: { id },
        data: {
          status: RunStatus.REVIEW,
          progress: 100,
          uxScore: 72,
          completionRate: 76,
          frictionCount: demoFindings.length,
          completedAt: new Date(),
        },
        include: { project: true, findings: true, events: { orderBy: { createdAt: "asc" } } },
      });
      stream.next({ type: "complete", data: completed });
      stream.complete();
    } catch (error) {
      await this.prisma.testRun.update({
        where: { id },
        data: { status: RunStatus.FAILED },
      });
      stream.error(error);
    }
  }
}
