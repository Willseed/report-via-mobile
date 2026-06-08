import {
  ApplicationConfig,
  InjectionToken,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';

export const NOMINATIM_USER_AGENT = new InjectionToken<string>('NominatimUserAgent');

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withXhr()),
    {
      provide: NOMINATIM_USER_AGENT,
      useValue: 'report-via-mobile (https://tools.pylot.dev)',
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
