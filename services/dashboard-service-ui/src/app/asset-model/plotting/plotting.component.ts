import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import * as echarts from 'echarts';

interface MeasurementRecord {
  timestamp: string;
  value: number | boolean | string | null;
}

interface MeasurementResponse {
  asset_variable_id: string;
  data_type: string;
  unit: string | null;
  data?: MeasurementRecord[];
}

@Component({
  selector: 'app-plotting',
  standalone: false,
  templateUrl: './plotting.component.html',
  styleUrl: './plotting.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class PlottingComponent implements OnInit, OnDestroy {
  @ViewChild('chart', { static: false }) chartElement?: ElementRef<HTMLDivElement>;

  variableId: string | null = null;
  from: string | null = null;
  to: string | null = null;
  limit: number | null = null;
  dataType: string | null = null;
  unit: string | null = null;
  isLoading = false;
  errorMessage: string | null = null;
  chartData: Array<[number, number]> = [];

  private readonly measurementsApiUrl = 'http://localhost:3001/measurements';
  private chart: echarts.ECharts | null = null;
  private readonly resizeHandler = () => this.chart?.resize();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    window.addEventListener('resize', this.resizeHandler);

    this.route.queryParamMap.subscribe((params) => {
      this.variableId = params.get('variableId');
      this.from = params.get('from');
      this.to = params.get('to');
      const limitValue = params.get('limit');
      this.limit = limitValue ? Number(limitValue) : null;

      this.loadMeasurements();
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeHandler);
    this.chart?.dispose();
  }

  goBack(): void {
    this.router.navigate(['/asset-hierarchy']);
  }

  private loadMeasurements(): void {
    if (!this.variableId || !this.from || !this.to) {
      this.errorMessage = 'Missing plotting parameters.';
      this.chartData = [];
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    const query = new URLSearchParams({
      asset_variable_id: this.variableId,
      from: this.from,
      to: this.to,
      limit: String(this.limit ?? 100),
    });

    this.http.get<MeasurementResponse>(`${this.measurementsApiUrl}?${query.toString()}`).subscribe({
      next: (response) => {
        this.dataType = response.data_type;
        this.unit = response.unit ?? null;
        this.chartData = this.normalizeSeries(response.data ?? []);
        this.isLoading = false;

        this.cd.detectChanges();
        this.renderChart();
      },
      error: () => {
        this.errorMessage = 'Failed to load measurements for this variable. Please try a different time range.';
        this.chartData = [];
        this.isLoading = false;
        this.clearChart();
      },
    });
  }

  private normalizeSeries(data: MeasurementRecord[]): Array<[number, number]> {
    return data.reduce<Array<[number, number]>>((accumulator, entry) => {
      const numericValue = this.toNumericValue(entry.value);
      const timestamp = new Date(entry.timestamp).getTime();

      if (numericValue === null || Number.isNaN(timestamp)) {
        return accumulator;
      }

      accumulator.push([timestamp, numericValue]);
      return accumulator;
    }, []);
  }

  private toNumericValue(value: number | boolean | string | null): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    if (typeof value === 'string') {
      const parsedValue = Number(value);
      return Number.isFinite(parsedValue) ? parsedValue : null;
    }

    return null;
  }

  private renderChart(): void {
    if (!this.chartElement) {
      return;
    }

    const container = this.chartElement.nativeElement;

    if (!this.chartData.length) {
      this.clearChart();
      return;
    }

    if (!this.chart) {
      this.chart = echarts.init(container, 'dark');
    }

    this.chart.setOption(
      {
        backgroundColor: '#0b1220',
        animationDuration: 300,
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#111827',
          borderColor: '#374151',
          textStyle: {
            color: '#f9fafb',
          },
        },
        grid: {
          left: 50,
          right: 20,
          top: 20,
          bottom: 40,
          containLabel: true,
        },
        xAxis: {
          type: 'time',
          boundaryGap: false,
          axisLine: {
            lineStyle: {
              color: '#94a3b8',
            },
          },
          axisLabel: {
            color: '#cbd5e1',
            formatter: {
              month: 'short',
              day: 'numeric',
            },
          },
        },
        yAxis: {
          type: 'value',
          axisLine: {
            lineStyle: {
              color: '#94a3b8',
            },
          },
          axisLabel: {
            color: '#cbd5e1',
          },
          splitLine: {
            lineStyle: {
              color: '#1f2937',
            },
          },
        },
        series: [
          {
            name: this.variableId ?? 'Measurement',
            type: 'line',
            smooth: true,
            showSymbol: false,
            symbolSize: 6,
            data: this.chartData,
            lineStyle: {
              width: 3,
              color: '#7dd3fc',
            },
            itemStyle: {
              color: '#38bdf8',
            },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(56, 189, 248, 0.45)' },
                { offset: 1, color: 'rgba(56, 189, 248, 0.05)' },
              ]),
            },
          },
        ],
      },
      true,
    );
    this.chart.resize();
  }

  private clearChart(): void {
    if (this.chart) {
      this.chart.clear();
    }
  }
}
