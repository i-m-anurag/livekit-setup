import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { RoomComponent } from './components/room/room.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'room', component: RoomComponent, canActivate: [authGuard] },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
