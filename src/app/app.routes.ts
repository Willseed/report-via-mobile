import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./sms-form/sms-form').then((m) => m.SmsForm) },
];
