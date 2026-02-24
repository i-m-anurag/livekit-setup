import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  username = '';
  password = '';
  error = '';
  loading = false;

  constructor(private authService: AuthService, private router: Router) {}

  async login() {
    this.loading = true;
    this.error = '';
    this.authService.login(this.username, this.password).subscribe({
      next: () => {
        this.router.navigate(['/room']);
      },
      error: (err) => {
        this.error = err.error?.error || 'Login failed';
        this.loading = false;
      },
    });
  }

  async register() {
    this.loading = true;
    this.error = '';
    this.authService.register(this.username, this.password).subscribe({
      next: () => {
        this.router.navigate(['/room']);
      },
      error: (err) => {
        this.error = err.error?.error || 'Registration failed';
        this.loading = false;
      },
    });
  }
}
