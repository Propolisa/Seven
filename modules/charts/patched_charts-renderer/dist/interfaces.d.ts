import { Page } from 'puppeteer';
export interface RenderOptions {
    init: InitOptions;
    charts: ChartOptions | ChartOptions[];
}
export interface InitOptions {
    width: number;
    height: number;
    cb?: (page: Page) => void;
    containerSelector?: string;
    screenshotSelector?: string;
    pdf?: boolean;
}
export interface ChartOptions {
    file: {
        path: string;
    };
    preRenderCb?: (page: Page) => void;
    postRenderCb?: (page: Page) => void;
    config: any;
}
export interface Exporter {
    render: (page: Page, options: ChartOptions, initOptions: InitOptions) => Promise<void>;
    init?: (page: Page, options: InitOptions) => Promise<void>;
}
