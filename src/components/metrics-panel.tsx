'use client';

import { useQuery } from '@tanstack/react-query';
import { CircularGauge } from './circular-gauge';
import { StatusPill } from './ui/status-pill';

interface MetricResult {
  metric: Record<string, string>;
  value: [number, string];
}

async function instant(query: string): Promise<MetricResult[]> {
  try {
    const res = await fetch(`/api/metrics?query=${encodeURIComponent(query)}`);
    const data = await res.json();
    return data?.data?.result ?? [];
  } catch {
    return [];
  }
}

function pick(results: MetricResult[], labelMatch?: Record<string, string>): number | null {
  const r = labelMatch
    ? results.find((r) => Object.entries(labelMatch).every(([k, v]) => r.metric[k] === v))
    : results[0];
  return r ? parseFloat(r.value[1]) : null;
}

interface GpuHostDef {
  key: string;
  label: string;
  model: string;
  unified: boolean;
  utilLabel: Record<string, string>;
  tempLabel: Record<string, string>;
  powerLabel: Record<string, string>;
  vramLabel: Record<string, string> | null;
  maxPower: number;
}

const GPU_HOSTS: GpuHostDef[] = [
  { key: 'spark-2', label: 'spark-2', model: 'NVIDIA GB10',   unified: true,  utilLabel: { host: 'spark-2' }, tempLabel: { host: 'spark-2' }, powerLabel: { host: 'spark-2' }, vramLabel: null,                maxPower: 250 },
  { key: 'jarvis',  label: 'jarvis',  model: 'RTX PRO 6000',  unified: false, utilLabel: { host: 'jarvis'  }, tempLabel: { host: 'jarvis'  }, powerLabel: { host: 'jarvis'  }, vramLabel: { host: 'jarvis' }, maxPower: 300 },
  { key: 'spark-1', label: 'spark-1', model: 'NVIDIA GB10',   unified: true,  utilLabel: { name: 'NVIDIA_GB10' }, tempLabel: { name: 'NVIDIA_GB10' }, powerLabel: { name: 'NVIDIA_GB10' }, vramLabel: null, maxPower: 250 },
  { key: 'gesserit',label: 'gesserit',model: 'RTX 3090',      unified: false, utilLabel: { host: 'gesserit'}, tempLabel: { host: 'gesserit'}, powerLabel: { host: 'gesserit'}, vramLabel: { host: 'gesserit' }, maxPower: 350 },
];

const SYS_HOSTS = ['spark-2', 'spark-1', 'jarvis', 'gesserit', 'MacStudio', 'm4'];

async function fetchGPU() {
  const [util, util1, temp, temp1, power, power1, vramUsed, vramFree] = await Promise.all([
    instant('DCGM_FI_DEV_GPU_UTIL'), instant('nvidia_gpu_utilization_percent'),
    instant('DCGM_FI_DEV_GPU_TEMP'), instant('nvidia_gpu_temperature_celsius'),
    instant('DCGM_FI_DEV_POWER_USAGE'), instant('nvidia_gpu_power_draw_watts'),
    instant('DCGM_FI_DEV_FB_USED'), instant('DCGM_FI_DEV_FB_FREE'),
  ]);
  return { util: [...util, ...util1], temp: [...temp, ...temp1], power: [...power, ...power1], vramUsed, vramFree };
}

async function fetchSys() {
  const [mem, cpu] = await Promise.all([
    instant('(node_memory_MemAvailable_bytes or (node_memory_free_bytes + node_memory_inactive_bytes)) / 1024 / 1024 / 1024'),
    instant('(1 - avg by (host) (rate(node_cpu_seconds_total{mode="idle"}[1m]))) * 100'),
  ]);
  return { mem, cpu };
}

async function fetchLLM() {
  const [running, waiting, rate, spend] = await Promise.all([
    instant('sum(vllm:num_requests_running)'), instant('sum(vllm:num_requests_waiting)'),
    instant('round(rate(litellm_proxy_total_requests_metric_total[5m]) * 300)'), instant('litellm_spend_metric_total'),
  ]);
  return { running, waiting, rate, spend };
}

type GpuData = Awaited<ReturnType<typeof fetchGPU>>;

function VramBar({ used, free }: { used: number | null; free: number | null }) {
  if (used === null || free === null) return null;
  const usedGb = used / 1024;
  const totalGb = (used + free) / 1024;
  const pct = Math.round((usedGb / totalGb) * 100);
  const barColor = pct >= 95 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-cyan-500';
  return (
    <div className='w-full'>
      <div className='flex justify-between text-[10px] text-zinc-400 mb-1'>
        <span>VRAM</span>
        <span className='font-mono tabular-nums'>{usedGb.toFixed(1)}/{totalGb.toFixed(0)} GiB</span>
      </div>
      <div className='h-1.5 rounded-full overflow-hidden' style={{ background: 'var(--data-track)' }}>
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatRow({ label, value, unit }: { label: string; value: string | null; unit?: string }) {
  return (
    <div className='flex justify-between items-baseline text-xs'>
      <span className='text-zinc-500'>{label}</span>
      <span className='font-mono tabular-nums text-zinc-200'>
        {value !== null ? <>{value}{unit && <span className='text-zinc-500 ml-0.5'>{unit}</span>}</> : <span className='text-zinc-600'>—</span>}
      </span>
    </div>
  );
}

function GpuHostCard({ host, gpu }: { host: GpuHostDef; gpu: GpuData }) {
  const util  = pick(gpu.util,  host.utilLabel);
  const temp  = pick(gpu.temp,  host.tempLabel);
  const power = pick(gpu.power, host.powerLabel);
  const vramUsed = host.vramLabel ? pick(gpu.vramUsed, host.vramLabel) : null;
  const vramFree = host.vramLabel ? pick(gpu.vramFree, host.vramLabel) : null;
  const online = util !== null || temp !== null;

  return (
    <div className='bg-zinc-900 border border-zinc-800 rounded-xl p-4'>
      <div className='flex items-center justify-between mb-4'>
        <div>
          <div className='text-[10px] text-zinc-500 uppercase tracking-widest mb-0.5'>HOST</div>
          <div className='text-sm font-semibold text-zinc-100'>{host.label}</div>
        </div>
        <div className='text-right'>
          <div className='text-[10px] text-zinc-500 uppercase tracking-widest mb-0.5'>GPU</div>
          <div className='text-sm text-zinc-300'>{host.model}</div>
        </div>
        <StatusPill status={online ? 'online' : 'offline'} />
      </div>
      <div className='flex items-start gap-4'>
        <div className='flex gap-3'>
          <CircularGauge value={util}  max={100}           label='GPU Load' unit='%'  warn={70}                   crit={90}                   size={88} />
          <CircularGauge value={power} max={host.maxPower} label='Power'    unit='W'  warn={host.maxPower * 0.75} crit={host.maxPower * 0.9}  size={88} />
          <CircularGauge value={temp}  max={100}           label='Temp'     unit='°C' warn={75}                   crit={85}                   size={88} />
        </div>
        <div className='flex-1 min-w-0 space-y-2 pt-1'>
          {host.unified
            ? <div className='text-[10px] text-zinc-600 italic'>Unified memory arch</div>
            : <VramBar used={vramUsed} free={vramFree} />}
          <StatRow label='Power draw' value={power !== null ? power.toFixed(0) : null} unit='W' />
          <StatRow label='Temp'       value={temp  !== null ? temp.toFixed(0)  : null} unit='°C' />
        </div>
      </div>
    </div>
  );
}

export function MetricsPanel() {
  const { data: gpu, isLoading: gpuLoading, dataUpdatedAt: gpuAt } = useQuery({ queryKey: ['gpu'], queryFn: fetchGPU, refetchInterval: 30_000 });
  const { data: sys } = useQuery({ queryKey: ['sys'], queryFn: fetchSys, refetchInterval: 30_000 });
  const { data: llm } = useQuery({ queryKey: ['llm'], queryFn: fetchLLM, refetchInterval: 30_000 });

  const updatedAt = gpuAt ? new Date(gpuAt) : null;

  function SectionHeading({ children }: { children: React.ReactNode }) {
    return <h3 className='text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 mt-6 first:mt-0'>{children}</h3>;
  }

  return (
    <div>
      <div className='flex items-center justify-between mb-6'>
        <h2 className='text-xl font-semibold'>Metrics</h2>
        <span className='text-xs text-zinc-500'>
          {gpuLoading ? 'loading…' : updatedAt ? `updated ${updatedAt.toLocaleTimeString()}` : ''}
        </span>
      </div>

      <SectionHeading>GPU</SectionHeading>
      {gpuLoading ? (
        <div className='grid grid-cols-1 xl:grid-cols-2 gap-3'>
          {GPU_HOSTS.map((h) => <div key={h.key} className='bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-36 animate-pulse' />)}
        </div>
      ) : (
        <div className='grid grid-cols-1 xl:grid-cols-2 gap-3'>
          {GPU_HOSTS.map((h) => <GpuHostCard key={h.key} host={h} gpu={gpu!} />)}
        </div>
      )}

      <SectionHeading>System Memory</SectionHeading>
      <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2'>
        {SYS_HOSTS.map((h) => {
          const v = sys ? pick(sys.mem, { host: h }) : null;
          const color = v === null ? 'text-zinc-600' : v < 4 ? 'text-red-400' : v < 8 ? 'text-amber-400' : 'text-zinc-100';
          return (
            <div key={h} className='bg-zinc-900 border border-zinc-800 rounded-lg p-2.5'>
              <div className='text-[10px] text-zinc-500 truncate mb-1'>{h}</div>
              <div className={`text-base font-semibold font-mono tabular-nums ${color}`}>
                {v !== null ? <>{v.toFixed(1)}<span className='text-[10px] text-zinc-500 ml-0.5'>GiB</span></> : <span className='text-zinc-600'>—</span>}
              </div>
            </div>
          );
        })}
      </div>

      <SectionHeading>LLM</SectionHeading>
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-2'>
        {([
          { label: 'vLLM active',    value: llm ? pick(llm.running) : null, unit: undefined, warn: undefined, crit: undefined },
          { label: 'vLLM queued',    value: llm ? pick(llm.waiting) : null, unit: undefined, warn: 1,         crit: 4 },
          { label: 'LiteLLM req/5m', value: llm ? pick(llm.rate)    : null, unit: undefined, warn: undefined, crit: undefined },
          { label: 'LiteLLM spend',  value: llm ? pick(llm.spend)   : null, unit: '$',       warn: undefined, crit: undefined },
        ] as const).map(({ label, value, unit, warn, crit }) => {
          const color = value === null ? 'text-zinc-600'
            : crit !== undefined && value >= crit ? 'text-red-400'
            : warn !== undefined && value >= warn ? 'text-amber-400'
            : 'text-zinc-100';
          return (
            <div key={label} className='bg-zinc-900 border border-zinc-800 rounded-lg p-3'>
              <div className='text-[10px] text-zinc-500 truncate mb-1'>{label}</div>
              <div className={`text-lg font-semibold font-mono tabular-nums ${color}`}>
                {value !== null
                  ? <>{value.toFixed(unit === '$' ? 2 : 0)}{unit && <span className='text-xs text-zinc-500 ml-0.5'>{unit}</span>}</>
                  : <span className='text-zinc-600'>—</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
