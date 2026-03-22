/**
 * Health Check Indicator - Shows OpenClaw Gateway connection status
 * 
 * Simple icon-only indicator in a rounded square badge style
 * matching the tab badge design.
 */

import { Notice, setIcon } from 'obsidian';

export type HealthStatus = 'connected' | 'disconnected' | 'checking' | 'error';

export interface HealthCheckCallbacks {
  onCheckHealth: () => Promise<boolean>;
}

export class HealthCheckIndicator {
  private container: HTMLElement;
  private iconContainer: HTMLElement;
  private callbacks: HealthCheckCallbacks;
  private currentStatus: HealthStatus = 'checking';
  private checkInterval: number | null = null;
  private readonly CHECK_INTERVAL_MS = 30000; // Check every 30 seconds

  constructor(parentEl: HTMLElement, callbacks: HealthCheckCallbacks) {
    this.callbacks = callbacks;
    this.container = parentEl.createDiv({ cls: 'ele-health-check-indicator' });
    this.container.setAttribute('aria-label', 'OpenClaw: checking...');
    
    // Icon container (inner)
    this.iconContainer = this.container.createDiv({ cls: 'ele-health-icon' });
    
    // Click to manually check health
    this.container.addEventListener('click', () => {
      this.checkHealth();
    });
    
    // Start periodic health checks
    this.startPeriodicChecks();
    
    // Initial check
    this.checkHealth();
  }

  private updateIcon(): void {
    this.iconContainer.empty();
    
    // Remove previous status classes
    this.container.removeClass('ele-health-connected', 'ele-health-disconnected', 'ele-health-checking', 'ele-health-error');
    
    switch (this.currentStatus) {
      case 'connected':
        setIcon(this.iconContainer, 'check'); // Checkmark
        this.container.addClass('ele-health-connected');
        this.container.setAttribute('aria-label', 'OpenClaw: connected');
        break;
      case 'disconnected':
        setIcon(this.iconContainer, 'x'); // X
        this.container.addClass('ele-health-disconnected');
        this.container.setAttribute('aria-label', 'OpenClaw: disconnected');
        break;
      case 'checking':
        setIcon(this.iconContainer, 'loader'); // Spinner
        this.container.addClass('ele-health-checking');
        this.container.setAttribute('aria-label', 'OpenClaw: checking...');
        break;
      case 'error':
        setIcon(this.iconContainer, 'alert-triangle'); // Warning
        this.container.addClass('ele-health-error');
        this.container.setAttribute('aria-label', 'OpenClaw: error');
        break;
    }
  }

  setStatus(status: HealthStatus): void {
    if (this.currentStatus === status) return;
    
    this.currentStatus = status;
    this.updateIcon();
  }

  async checkHealth(): Promise<void> {
    const previousStatus = this.currentStatus;
    this.setStatus('checking');
    
    try {
      const isHealthy = await this.callbacks.onCheckHealth();
      
      if (isHealthy) {
        this.setStatus('connected');
        // Show notice only if transitioning from disconnected/error to connected
        if (previousStatus === 'disconnected' || previousStatus === 'error') {
          new Notice('OpenClaw Gateway connected', 3000);
        }
      } else {
        this.setStatus('disconnected');
        if (previousStatus === 'connected') {
          new Notice('OpenClaw Gateway disconnected', 5000);
        }
      }
    } catch (error) {
      console.error('[HealthCheckIndicator] Health check failed:', error);
      this.setStatus('error');
    }
  }

  private startPeriodicChecks(): void {
    if (this.checkInterval) {
      window.clearInterval(this.checkInterval);
    }
    
    this.checkInterval = window.setInterval(() => {
      this.checkHealth();
    }, this.CHECK_INTERVAL_MS);
  }

  stopPeriodicChecks(): void {
    if (this.checkInterval) {
      window.clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  destroy(): void {
    this.stopPeriodicChecks();
    this.container.remove();
  }
}
