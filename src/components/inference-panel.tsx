'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ── helpers ────────────────────────────────────────────────────────────────

type InstantResult = { metric: Record<string, string>; value: [number, string] };
type RangeResult   = { metric: Record<string, string>; values: [number, string][] };

async function instant(query: string): Promise<InstantResult[]> {
  try {
    const r = await fetch(`/api/metrics?query=${encodeURIComponent(query)}`);
    return (await r.json())?.data?.result ?? [];
  } catch { return []; }
}

async function range(query: string, window: string, step: number): Promise<RangeResult[]> {
  try {
    const r = await fetch(`/api/metrics?query=${encodeURIComponent(query)}&range=${window}&step=${step}`);
    return (await r.json())?.data?.result ?? [];
  } catch { return []; }
}

function pickI(results: InstantResult[], label?: Record<string, string>): number | null {
  const r = label
    ? results.find(r => Object.entries(label).every(([k, v]) => r.metric[k] === v))
    : results[0];
  return r ? parseFloat(r.value[1]) : null;
}

function fmt(n: number | null, decimals = 1, suffix = ''): string {
  if (n === null || isNaN(n)) return '—';
  return n.toFixed(decimals) + suffix;
}

function fmtTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Shorten a model path like "/models/Qwen3.6-27B-FP8" → "Qwen3.6-27B" */
function shortModel(name: string): string {
  return name.replace(/^\/models\//, '').replace(/-FP8|-NVFP4|-A3B|-Reasoning/gi, '').slice(0, 22);
}

// Categorical colors per series index
const SERIES_COLORS = ['#22d3ee', '#60a5fa', '#c084fc', '#fbbf24', '#f87171', '#4ade80'];

/** Convert Prometheus range results → recharts data array */
function toChartData(
  results: RangeResult[],
  labelKey = 'model_name',
): { t: number; [k: string]: number }[] {
  if (!results.length) return [];
  const times = results[0].values.map(([t]) => t);
  return times.map((t, i) => {
    const pt: { t: number; [k: string]: number } = { t };
    results.forEach(r => {
      const key = shortModel(r.metric[labelKey] ?? r.metric.model ?? r.metric.host ?? 'value');
      const v = parseFloat(r.values[i]?.[1] ?? 'NaN');
      pt[key] = isNaN(v) ? 0 : +v.toFixed(4);
    });
    return pt;
  });
}

// ── shared chart primitives ────────────────────────────────────────────────

const chartCommon = {
  grid: <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />,
  xAxis: (
    <XAxis
      dataKey="t"
      tickFormatter={fmtTime}
      tick={{ fontSize: 10, fill: '#71717a' }}
      tickLine={false}
      axisLine={false}
      minTickGap={40}
    />
  ),
  yAxis: (dec = 0) => (
    <YAxis
      tick={{ fontSize: 10, fill: '#71717a' }}
      tickLine={false}
      axisLine={false}
      width={40}
      tickFormatter={v => typeof v === 'number' ? v.toFixed(dec) : v}
    />
  ),
  tooltip: (unit = '') => (
    <Tooltip
      contentStyle={{
        background: '#18181b',
        border: '1px solid #3f3f46',
        borderRadius: 6,
        fontSize: 11,
        color: '#f4f4f5',
      }}
      labelFormatter={(v: unknown) => fmtTime(Number(v))}
      formatter={(v: unknown) => {
        const n = typeof v === 'number' ? v : parseFloat(String(v));
        return [isNaN(n) ? '—' : n.toFixed(3) + unit, ''] as [string, string];
      }}
    />
  ),
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">{title}</div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
      <div className="text-[10px] text-zinc-500 truncate mb-1">{label}</div>
      <div className="text-lg font-semibold font-mono tabular-nums text-zinc-100">{value}</div>
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-zinc-200 mt-8 mb-3 first:mt-0 border-b border-zinc-800 pb-2">
      {children}
    </h3>
  );
}

// ── time range picker ──────────────────────────────────────────────────────

const RANGES = [
  { label: '15m', step: 15 },
  { label: '1h',  step: 60 },
  { label: '6h',  step: 360 },
  { label: '24h', step: 1440 },
];

// ── vLLM section ──────────────────────────────────────────────────────────

function useVllmInstant() {
  return useQuery({
    queryKey: ['vllm-instant'],
    queryFn: async () => {
      const [running, waiting, kv, genRate] = await Promise.all([
        instant('sum(vllm:num_requests_running)'),
        instant('sum(vllm:num_requests_waiting)'),
        instant('avg(vllm:kv_cache_usage_perc)'),
        instant('sum(rate(vllm:generation_tokens_total[2m]))'),
      ]);
      return { running, waiting, kv, genRate };
    },
    refetchInterval: 15_000,
  });
}

function useVllmRange(win: string, step: number) {
  return useQuery({
    queryKey: ['vllm-range', win],
    queryFn: async () => {
      const [genThroughput, queue, ttft, e2e] = await Promise.all([
        range('sum by (model_name) (rate(vllm:generation_tokens_total[2m]))', win, step),
        range('sum by (model_name) (vllm:num_requests_waiting)', win, step),
        range(
          'histogram_quantile(0.95, sum by (le, model_name) (rate(vllm:time_to_first_token_seconds_bucket[5m])))',
          win, step,
        ),
        range(
          'histogram_quantile(0.95, sum by (le, model_name) (rate(vllm:e2e_request_latency_seconds_bucket[5m])))',
          win, step,
        ),
      ]);
      return {
        genThroughput: toChartData(genThroughput),
        queue:         toChartData(queue),
        ttft:          toChartData(ttft),
        e2e:           toChartData(e2e),
        models: [...new Set(genThroughput.map(r => shortModel(r.metric.model_name ?? '')))].filter(Boolean),
      };
    },
    refetchInterval: 30_000,
  });
}

function VllmPanel({ win, step }: { win: string; step: number }) {
  const { data: inst } = useVllmInstant();
  const { data: r } = useVllmRange(win, step);

  const running = inst ? pickI(inst.running) : null;
  const waiting = inst ? pickI(inst.waiting) : null;
  const kv      = inst ? pickI(inst.kv) : null;
  const genRate = inst ? pickI(inst.genRate) : null;

  const models = r?.models ?? [];

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Stat label="Running requests" value={fmt(running, 0)} />
        <Stat label="Queued requests"  value={fmt(waiting, 0)} />
        <Stat label="KV cache"         value={kv !== null ? kv.toFixed(1) + ' %' : '—'} />
        <Stat label="Gen throughput"   value={genRate !== null ? genRate.toFixed(1) + ' tok/s' : '—'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-3">
        <ChartCard title="Generation Throughput (tok/s)">
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={r?.genThroughput ?? []}>
              {chartCommon.grid}
              {chartCommon.xAxis}
              {chartCommon.yAxis(1)}
              {chartCommon.tooltip(' tok/s')}
              {models.map((m, i) => (
                <Area
                  key={m} type="monotone" dataKey={m}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  fill={SERIES_COLORS[i % SERIES_COLORS.length] + '18'}
                  strokeWidth={1.5} dot={false} isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2">
            {models.map((m, i) => (
              <span key={m} className="flex items-center gap-1 text-[10px] text-zinc-400">
                <span className="inline-block w-2 h-0.5" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                {m}
              </span>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Queue Depth (requests waiting)">
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={r?.queue ?? []}>
              {chartCommon.grid}
              {chartCommon.xAxis}
              {chartCommon.yAxis(0)}
              {chartCommon.tooltip()}
              {models.map((m, i) => (
                <Area
                  key={m} type="monotone" dataKey={m}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  fill={SERIES_COLORS[i % SERIES_COLORS.length] + '18'}
                  strokeWidth={1.5} dot={false} isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <ChartCard title="P95 Time-to-First-Token (s)">
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={r?.ttft ?? []}>
              {chartCommon.grid}
              {chartCommon.xAxis}
              {chartCommon.yAxis(2)}
              {chartCommon.tooltip(' s')}
              {models.map((m, i) => (
                <Line
                  key={m} type="monotone" dataKey={m}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={1.5} dot={false} isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="P95 End-to-End Latency (s)">
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={r?.e2e ?? []}>
              {chartCommon.grid}
              {chartCommon.xAxis}
              {chartCommon.yAxis(2)}
              {chartCommon.tooltip(' s')}
              {models.map((m, i) => (
                <Line
                  key={m} type="monotone" dataKey={m}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={1.5} dot={false} isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  );
}

// ── LiteLLM section ───────────────────────────────────────────────────────

function useLiteLLMInstant() {
  return useQuery({
    queryKey: ['litellm-instant'],
    queryFn: async () => {
      const [reqRate, errRate, spend, deployments, inTok, outTok] = await Promise.all([
        instant('rate(litellm_proxy_total_requests_metric_total[5m]) * 60'),
        instant('rate(litellm_proxy_failed_requests_metric_total[5m]) * 60'),
        instant('litellm_spend_metric_total'),
        instant('litellm_deployment_state'),
        instant('rate(litellm_input_tokens_metric_total[5m]) * 60'),
        instant('rate(litellm_output_tokens_metric_total[5m]) * 60'),
      ]);
      return { reqRate, errRate, spend, deployments, inTok, outTok };
    },
    refetchInterval: 15_000,
  });
}

function useLiteLLMRange(win: string, step: number) {
  return useQuery({
    queryKey: ['litellm-range', win],
    queryFn: async () => {
      const [reqRate, inputTok, outputTok, latency] = await Promise.all([
        range('rate(litellm_proxy_total_requests_metric_total[2m]) * 60', win, step),
        range('sum(rate(litellm_input_tokens_metric_total[2m]) * 60)', win, step),
        range('sum(rate(litellm_output_tokens_metric_total[2m]) * 60)', win, step),
        range(
          'histogram_quantile(0.95, sum by (le) (rate(litellm_llm_api_latency_metric_bucket[5m])))',
          win, step,
        ),
      ]);
      return {
        reqRate:   toChartData(reqRate, 'model'),
        inputTok:  toChartData(inputTok,  'model'),
        outputTok: toChartData(outputTok, 'model'),
        latency:   toChartData(latency,   'le'),
      };
    },
    refetchInterval: 30_000,
  });
}

function LiteLLMPanel({ win, step }: { win: string; step: number }) {
  const { data: inst } = useLiteLLMInstant();
  const { data: r }    = useLiteLLMRange(win, step);

  const reqRate = inst ? pickI(inst.reqRate) : null;
  const errRate = inst ? pickI(inst.errRate) : null;
  const spend   = inst ? pickI(inst.spend) : null;
  const nDeploy = inst?.deployments.length ?? null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Stat label="Req / min"   value={fmt(reqRate, 1)} />
        <Stat label="Errors / min" value={fmt(errRate, 2)} />
        <Stat label="Total spend"  value={spend !== null ? '$' + spend.toFixed(2) : '—'} />
        <Stat label="Deployments"  value={nDeploy !== null ? String(nDeploy) : '—'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-3">
        <ChartCard title="Request Rate (req/min)">
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={r?.reqRate ?? []}>
              {chartCommon.grid}
              {chartCommon.xAxis}
              {chartCommon.yAxis(1)}
              {chartCommon.tooltip(' req/min')}
              <Area
                type="monotone" dataKey="value"
                stroke="#22d3ee" fill="#22d3ee18"
                strokeWidth={1.5} dot={false} isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="API Latency P95 (s)">
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={r?.latency ?? []}>
              {chartCommon.grid}
              {chartCommon.xAxis}
              {chartCommon.yAxis(2)}
              {chartCommon.tooltip(' s')}
              <Line
                type="monotone" dataKey="+Inf"
                stroke="#c084fc" strokeWidth={1.5}
                dot={false} isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-4">
        <ChartCard title="Input Tokens / min">
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={r?.inputTok ?? []}>
              {chartCommon.grid}
              {chartCommon.xAxis}
              {chartCommon.yAxis(0)}
              {chartCommon.tooltip(' tok/min')}
              <Area
                type="monotone" dataKey="value"
                stroke="#60a5fa" fill="#60a5fa18"
                strokeWidth={1.5} dot={false} isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Output Tokens / min">
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={r?.outputTok ?? []}>
              {chartCommon.grid}
              {chartCommon.xAxis}
              {chartCommon.yAxis(0)}
              {chartCommon.tooltip(' tok/min')}
              <Area
                type="monotone" dataKey="value"
                stroke="#4ade80" fill="#4ade8018"
                strokeWidth={1.5} dot={false} isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Deployment health table */}
      {inst?.deployments && inst.deployments.length > 0 && (
        <ChartCard title="Deployment Health">
          <div className="space-y-1">
            {inst.deployments.map(d => {
              const state = parseFloat(d.value[1]);
              const model = d.metric.litellm_model_name ?? d.metric.model ?? '?';
              const ok = state === 1;
              return (
                <div key={model} className="flex items-center justify-between text-xs py-1 border-b border-zinc-800 last:border-0">
                  <span className="font-mono text-zinc-300 truncate max-w-[70%]">{model}</span>
                  <span className={ok ? 'text-emerald-400' : 'text-zinc-500'}>
                    {ok ? 'healthy' : 'idle'}
                  </span>
                </div>
              );
            })}
          </div>
        </ChartCard>
      )}
    </>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────

export function InferencePanel() {
  const [rangeIdx, setRangeIdx] = useState(1); // default 1h
  const { label: win, step } = RANGES[rangeIdx];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Inference</h2>
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setRangeIdx(i)}
              className={`px-3 py-1 text-xs rounded-md transition-colors font-medium ${
                i === rangeIdx
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <SectionHead>vLLM — Inference Engine</SectionHead>
      <VllmPanel win={win} step={step} />

      <SectionHead>LiteLLM — Gateway</SectionHead>
      <LiteLLMPanel win={win} step={step} />
    </div>
  );
}
