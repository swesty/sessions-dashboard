'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type InstantResult = { metric: Record<string, string>; value: [number, string] };
type RangeResult = { metric: Record<string, string>; values: [number, string][] };
type ChartPoint = { t: number; [k: string]: number };

const MODEL_COLORS: Record<string, string> = {
  'qwen3.6-27b-fp8': '#22d3ee',
  'qwen3.6-35b-nvfp4': '#60a5fa',
  'nemotron-text': '#c084fc',
  'nemotron-omni': '#fbbf24',
};

const SERIES_COLORS = ['#22d3ee', '#60a5fa', '#c084fc', '#fbbf24', '#34d399', '#f472b6', '#a3e635', '#fb923c'];

function colorFor(model: string, index: number): string {
  return MODEL_COLORS[model] ?? SERIES_COLORS[index % SERIES_COLORS.length];
}

const TIME_RANGES: { label: string; win: string; step: number }[] = [
  { label: '15m', win: '15m', step: 15 },
  { label: '1h', win: '1h', step: 60 },
  { label: '6h', win: '6h', step: 360 },
  { label: '24h', win: '24h', step: 1440 },
];

async function instant(query: string): Promise<InstantResult[]> {
  const res = await fetch(`/api/metrics?query=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const json = await res.json();
  return json?.data?.result ?? [];
}

async function range(query: string, win: string, step: number): Promise<RangeResult[]> {
  const res = await fetch(`/api/metrics?query=${encodeURIComponent(query)}&range=${win}&step=${step}`);
  if (!res.ok) return [];
  const json = await res.json();
  return json?.data?.result ?? [];
}

function pickI(results: InstantResult[], label?: Record<string, string>): number | null {
  for (const r of results) {
    if (!label || Object.entries(label).every(([k, v]) => r.metric[k] === v)) {
      const n = parseFloat(r.value[1]);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

function sumI(results: InstantResult[]): number {
  return results.reduce((acc, r) => {
    const n = parseFloat(r.value[1]);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function fmt(n: number | null, decimals = 0, suffix = ''): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(decimals)}${suffix}`;
}

function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtTick(v: unknown): string {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (isNaN(n)) return '';
  const a = Math.abs(n);
  if (a === 0) return '0';
  if (a >= 10000) return (n / 1000).toFixed(0) + 'k';
  if (a >= 1000)  return (n / 1000).toFixed(1) + 'k';
  if (a >= 100)   return n.toFixed(0);
  if (a >= 10)    return n.toFixed(1);
  if (a >= 1)     return n.toFixed(2);
  return n.toFixed(3);
}

function yAxisWidth(results: RangeResult[]): number {
  let maxVal = 0;
  for (const r of results) {
    for (const [, v] of r.values) {
      const n = Math.abs(parseFloat(v));
      if (!isNaN(n) && isFinite(n)) maxVal = Math.max(maxVal, n);
    }
  }
  const label = fmtTick(maxVal);
  return Math.max(32, label.length * 7 + 12);
}

function toChartData(results: RangeResult[], labelKey = 'model'): ChartPoint[] {
  const byTime = new Map<number, ChartPoint>();
  const keys: string[] = [];
  results.forEach((r, i) => {
    const key = r.metric[labelKey] ?? `series-${i}`;
    if (!keys.includes(key)) keys.push(key);
    for (const [ts, val] of r.values) {
      let point = byTime.get(ts);
      if (!point) {
        point = { t: ts };
        byTime.set(ts, point);
      }
      const n = parseFloat(val);
      point[key] = Number.isFinite(n) ? n : 0;
    }
  });
  const out = Array.from(byTime.values()).sort((a, b) => a.t - b.t);
  for (const p of out) for (const k of keys) if (p[k] === undefined) p[k] = 0;
  return out;
}

function seriesKeys(results: RangeResult[], labelKey = 'model'): string[] {
  const keys: string[] = [];
  results.forEach((r, i) => {
    const key = r.metric[labelKey] ?? `series-${i}`;
    if (!keys.includes(key)) keys.push(key);
  });
  return keys;
}

function scaleRange(results: RangeResult[], factor: number): RangeResult[] {
  return results.map((r) => ({
    ...r,
    values: r.values.map(([t, v]) => [t, String(parseFloat(v) * factor)] as [number, string]),
  }));
}

const tooltipStyle = {
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: '6px',
  fontSize: '11px',
  color: '#e4e4e7',
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="mb-2 text-xs font-medium text-zinc-400">{title}</div>
      {children}
    </div>
  );
}

function ChartLegend({ keys }: { keys: string[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
      {keys.map((k, i) => (
        <div key={k} className="flex items-center gap-1.5 text-[10px] text-zinc-400">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: colorFor(k, i) }} />
          {k}
        </div>
      ))}
    </div>
  );
}

function makeTooltipFormatter(suffix: string, decimals: number) {
  return (value: unknown, name: unknown) => {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return [`${Number.isFinite(n) ? n.toFixed(decimals) : '—'}${suffix}`, String(name)];
  };
}

function MultiAreaChart({
  results,
  labelKey = 'model',
  suffix = '',
  decimals = 1,
  stacked = false,
}: {
  results: RangeResult[];
  labelKey?: string;
  suffix?: string;
  decimals?: number;
  stacked?: boolean;
}) {
  const data = toChartData(results, labelKey);
  const keys = seriesKeys(results, labelKey);
  return (
    <>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: 4 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
          <XAxis dataKey="t" tickFormatter={fmtTime} tick={{ fill: '#71717a', fontSize: 10 }} stroke="#3f3f46" minTickGap={32} />
          <YAxis width={yAxisWidth(results)} tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={fmtTick} stroke='#3f3f46' />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(l: unknown) => fmtTime(Number(l))} formatter={makeTooltipFormatter(suffix, decimals)} />
          {keys.map((k, i) => (
            <Area
              key={k}
              type="monotone"
              dataKey={k}
              stackId={stacked ? 'a' : undefined}
              stroke={colorFor(k, i)}
              fill={colorFor(k, i)}
              fillOpacity={0.18}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      {keys.length > 1 && <ChartLegend keys={keys} />}
    </>
  );
}

function MultiLineChart({
  results,
  labelKey = 'model',
  suffix = '',
  decimals = 2,
}: {
  results: RangeResult[];
  labelKey?: string;
  suffix?: string;
  decimals?: number;
}) {
  const data = toChartData(results, labelKey);
  const keys = seriesKeys(results, labelKey);
  return (
    <>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: 4 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
          <XAxis dataKey="t" tickFormatter={fmtTime} tick={{ fill: '#71717a', fontSize: 10 }} stroke="#3f3f46" minTickGap={32} />
          <YAxis width={yAxisWidth(results)} tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={fmtTick} stroke='#3f3f46' />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(l: unknown) => fmtTime(Number(l))} formatter={makeTooltipFormatter(suffix, decimals)} />
          {keys.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} stroke={colorFor(k, i)} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {keys.length > 1 && <ChartLegend keys={keys} />}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-100 tabular-nums">{value}</div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mt-8 mb-4 flex items-center gap-3">
      <span className="text-sm font-semibold tracking-wide text-zinc-300">{title}</span>
      <span className="h-px flex-1 bg-zinc-800" />
    </div>
  );
}

export function InferencePanel() {
  const [rangeKey, setRangeKey] = useState('1h');
  const tr = TIME_RANGES.find((r) => r.label === rangeKey) ?? TIME_RANGES[1];
  const { win, step } = tr;

  const iOpts = { refetchInterval: 10_000, staleTime: 5_000 };
  const rOpts = { refetchInterval: 30_000, staleTime: 25_000 };

  const vRunning = useQuery({ queryKey: ['v-running'], queryFn: () => instant('sum by (model) (vllm:num_requests_running)'), ...iOpts });
  const vWaiting = useQuery({ queryKey: ['v-waiting'], queryFn: () => instant('sum by (model) (vllm:num_requests_waiting)'), ...iOpts });
  const vKv = useQuery({ queryKey: ['v-kv'], queryFn: () => instant('vllm:kv_cache_usage_perc'), ...iOpts });
  const vGen = useQuery({ queryKey: ['v-gen'], queryFn: () => instant('sum by (model) (rate(vllm:generation_tokens_total[2m]))'), ...iOpts });
  const vPrefix = useQuery({
    queryKey: ['v-prefix'],
    queryFn: () => instant('sum(rate(vllm:prefix_cache_hits_total[5m])) / clamp_min(sum(rate(vllm:prefix_cache_queries_total[5m])),1) * 100'),
    ...iOpts,
  });
  const vSuccess = useQuery({ queryKey: ['v-success'], queryFn: () => instant('sum(rate(vllm:request_success_total[5m]))'), ...iOpts });

  const vGenR = useQuery({ queryKey: ['v-gen-r', win, step], queryFn: () => range('sum by (model) (rate(vllm:generation_tokens_total[2m]))', win, step), ...rOpts });
  const vPromptR = useQuery({ queryKey: ['v-prompt-r', win, step], queryFn: () => range('sum by (model) (rate(vllm:prompt_tokens_total[2m]))', win, step), ...rOpts });
  const vWaitR = useQuery({ queryKey: ['v-wait-r', win, step], queryFn: () => range('sum by (model) (vllm:num_requests_waiting)', win, step), ...rOpts });
  const vKvR = useQuery({ queryKey: ['v-kv-r', win, step], queryFn: () => range('vllm:kv_cache_usage_perc', win, step), ...rOpts });
  const vTtftR = useQuery({
    queryKey: ['v-ttft-r', win, step],
    queryFn: () => range('histogram_quantile(0.95, sum by (le,model) (rate(vllm:time_to_first_token_seconds_bucket[5m])))', win, step),
    ...rOpts,
  });
  const vTpotR = useQuery({
    queryKey: ['v-tpot-r', win, step],
    queryFn: () => range('histogram_quantile(0.95, sum by (le,model) (rate(vllm:request_time_per_output_token_seconds_bucket[5m])))', win, step),
    ...rOpts,
  });
  const vE2eR = useQuery({
    queryKey: ['v-e2e-r', win, step],
    queryFn: () => range('histogram_quantile(0.95, sum by (le,model) (rate(vllm:e2e_request_latency_seconds_bucket[5m])))', win, step),
    ...rOpts,
  });
  const vQueueR = useQuery({
    queryKey: ['v-queue-r', win, step],
    queryFn: () => range('histogram_quantile(0.95, sum by (le,model) (rate(vllm:request_queue_time_seconds_bucket[5m])))', win, step),
    ...rOpts,
  });

  const lReq = useQuery({ queryKey: ['l-req'], queryFn: () => instant('rate(litellm_proxy_total_requests_metric_total[5m]) * 60'), ...iOpts });
  const lFail = useQuery({ queryKey: ['l-fail'], queryFn: () => instant('rate(litellm_proxy_failed_requests_metric_total[5m]) * 60'), ...iOpts });
  const lSpend = useQuery({ queryKey: ['l-spend'], queryFn: () => instant('litellm_spend_metric_total'), ...iOpts });
  const lState = useQuery({ queryKey: ['l-state'], queryFn: () => instant('litellm_deployment_state'), ...iOpts });
  const lDeployReq = useQuery({ queryKey: ['l-deploy-req'], queryFn: () => instant('sum by (litellm_model_name) (litellm_deployment_total_requests_total)'), ...iOpts });
  const lCacheMiss = useQuery({ queryKey: ['l-cache-miss'], queryFn: () => instant('rate(litellm_cache_misses_metric_total[5m]) * 60'), ...iOpts });

  const lReqR = useQuery({ queryKey: ['l-req-r', win, step], queryFn: () => range('sum by (litellm_model_name) (rate(litellm_deployment_total_requests_total[2m]) * 60)', win, step), ...rOpts });
  const lInR = useQuery({ queryKey: ['l-in-r', win, step], queryFn: () => range('sum by (litellm_model_name) (rate(litellm_input_tokens_metric_total[2m]) * 60)', win, step), ...rOpts });
  const lOutR = useQuery({ queryKey: ['l-out-r', win, step], queryFn: () => range('sum by (litellm_model_name) (rate(litellm_output_tokens_metric_total[2m]) * 60)', win, step), ...rOpts });
  const lLatR = useQuery({ queryKey: ['l-lat-r', win, step], queryFn: () => range('histogram_quantile(0.95, sum by (le) (rate(litellm_llm_api_latency_metric_bucket[5m])))', win, step), ...rOpts });
  const lTtftR = useQuery({ queryKey: ['l-ttft-r', win, step], queryFn: () => range('histogram_quantile(0.95, sum by (le) (rate(litellm_llm_api_time_to_first_token_metric_bucket[5m])))', win, step), ...rOpts });
  const lErrR = useQuery({ queryKey: ['l-err-r', win, step], queryFn: () => range('rate(litellm_proxy_failed_requests_metric_total[2m]) * 60', win, step), ...rOpts });

  const fleetRows = (vKv.data ?? []).map((r) => {
    const model = r.metric.model;
    const host = r.metric.host ?? '—';
    return {
      model,
      host,
      running: pickI(vRunning.data ?? [], { model }),
      waiting: pickI(vWaiting.data ?? [], { model }),
      kv: parseFloat(r.value[1]) * 100,
      gen: pickI(vGen.data ?? [], { model }),
      litellm: pickI(lDeployReq.data ?? [], { litellm_model_name: model }),
    };
  });

  const vllmModels = (vKv.data ?? []).map((r) => r.metric.model);
  const litellmModels = (lState.data ?? []).map((r) => r.metric.litellm_model_name).filter(Boolean);
  const allModels = Array.from(new Set([...vllmModels, ...litellmModels]));
  const healthRows = allModels.map((model) => {
    const stateVal = pickI(lState.data ?? [], { litellm_model_name: model });
    const total = pickI(lDeployReq.data ?? [], { litellm_model_name: model });
    const isVllm = vllmModels.includes(model);
    let status = 'unknown';
    if (stateVal !== null) status = stateVal === 0 ? 'healthy' : 'unhealthy';
    else if (isVllm) status = 'idle';
    return { model, state: stateVal, total, status };
  });

  const statusColor = (s: string) =>
    s === 'healthy' ? 'text-emerald-400' : s === 'unhealthy' ? 'text-red-400' : s === 'idle' ? 'text-zinc-400' : 'text-zinc-500';

  return (
    <div className="space-y-2 text-zinc-200">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-100">Inference</h1>
        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/40 p-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRangeKey(r.label)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                rangeKey === r.label ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <SectionHeader title="Fleet Status" />
      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2 text-left">model</th>
              <th className="px-3 py-2 text-left">host</th>
              <th className="px-3 py-2 text-right">running</th>
              <th className="px-3 py-2 text-right">waiting</th>
              <th className="px-3 py-2 text-right">kv%</th>
              <th className="px-3 py-2 text-right">gen tok/s</th>
              <th className="px-3 py-2 text-right">litellm req</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {fleetRows.map((row, i) => (
              <tr key={`${row.model}-${row.host}`} className="text-zinc-300">
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: colorFor(row.model, i) }} />
                    {row.model}
                  </span>
                </td>
                <td className="px-3 py-2 text-zinc-400">{row.host}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(row.running)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(row.waiting)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(row.kv, 1, '%')}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(row.gen, 1)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(row.litellm)}</td>
              </tr>
            ))}
            {fleetRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">No vLLM models reporting</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <SectionHeader title="vLLM — Inference Engine" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total running" value={fmt(sumI(vRunning.data ?? []))} />
        <Stat label="Total waiting" value={fmt(sumI(vWaiting.data ?? []))} />
        <Stat label="Prefix cache hit" value={fmt(pickI(vPrefix.data ?? []), 1, '%')} />
        <Stat label="Success/min" value={fmt((pickI(vSuccess.data ?? []) ?? 0) * 60, 1)} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <ChartCard title="Generation Throughput (tok/s)">
          <MultiAreaChart results={vGenR.data ?? []} suffix=" tok/s" decimals={1} />
        </ChartCard>
        <ChartCard title="Prompt Throughput (tok/s)">
          <MultiAreaChart results={vPromptR.data ?? []} suffix=" tok/s" decimals={1} />
        </ChartCard>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <ChartCard title="KV Cache Usage (%)">
          <MultiAreaChart results={scaleRange(vKvR.data ?? [], 100)} suffix="%" decimals={1} />
        </ChartCard>
        <ChartCard title="Queue Depth">
          <MultiAreaChart results={vWaitR.data ?? []} decimals={0} />
        </ChartCard>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <ChartCard title="P95 TTFT (s)">
          <MultiLineChart results={vTtftR.data ?? []} suffix=" s" decimals={2} />
        </ChartCard>
        <ChartCard title="P95 TPOT (ms)">
          <MultiLineChart results={scaleRange(vTpotR.data ?? [], 1000)} suffix=" ms" decimals={1} />
        </ChartCard>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <ChartCard title="P95 E2E Latency (s)">
          <MultiLineChart results={vE2eR.data ?? []} suffix=" s" decimals={2} />
        </ChartCard>
        <ChartCard title="P95 Queue Time (s)">
          <MultiLineChart results={vQueueR.data ?? []} suffix=" s" decimals={2} />
        </ChartCard>
      </div>

      <SectionHeader title="LiteLLM — Gateway" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Req/min" value={fmt(sumI(lReq.data ?? []), 1)} />
        <Stat label="Errors/min" value={fmt(sumI(lFail.data ?? []), 1)} />
        <Stat label="Total spend" value={fmt(sumI(lSpend.data ?? []), 2, ' $')} />
        <Stat label="Cache misses/min" value={fmt(sumI(lCacheMiss.data ?? []), 1)} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <ChartCard title="Request Rate (req/min) per model">
          <MultiAreaChart results={lReqR.data ?? []} labelKey="litellm_model_name" suffix=" req/min" decimals={1} stacked />
        </ChartCard>
        <ChartCard title="Error Rate (errors/min)">
          <MultiAreaChart results={lErrR.data ?? []} labelKey="litellm_model_name" suffix=" err/min" decimals={2} />
        </ChartCard>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <ChartCard title="Input Tokens/min per model">
          <MultiAreaChart results={lInR.data ?? []} labelKey="litellm_model_name" suffix=" tok/min" decimals={0} stacked />
        </ChartCard>
        <ChartCard title="Output Tokens/min per model">
          <MultiAreaChart results={lOutR.data ?? []} labelKey="litellm_model_name" suffix=" tok/min" decimals={0} stacked />
        </ChartCard>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <ChartCard title="API Latency P95 (s)">
          <MultiLineChart results={lLatR.data ?? []} labelKey="litellm_model_name" suffix=" s" decimals={2} />
        </ChartCard>
        <ChartCard title="TTFT P95 (s)">
          <MultiLineChart results={lTtftR.data ?? []} labelKey="litellm_model_name" suffix=" s" decimals={2} />
        </ChartCard>
      </div>

      <SectionHeader title="Deployment Health" />
      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2 text-left">model</th>
              <th className="px-3 py-2 text-left">state</th>
              <th className="px-3 py-2 text-right">total requests</th>
              <th className="px-3 py-2 text-right">status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {healthRows.map((row, i) => (
              <tr key={row.model} className="text-zinc-300">
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: colorFor(row.model, i) }} />
                    {row.model}
                  </span>
                </td>
                <td className="px-3 py-2 text-zinc-400 tabular-nums">{row.state === null ? '—' : fmt(row.state)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(row.total)}</td>
                <td className={`px-3 py-2 text-right font-medium ${statusColor(row.status)}`}>{row.status}</td>
              </tr>
            ))}
            {healthRows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">No deployments reporting</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
