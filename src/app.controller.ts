import { Controller, Get, Header, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('email-preview')
  @Header('Content-Type', 'text/html')
  getEmailPreview(@Query('type') type?: string): string {
    const { 
      buildEmailHtml, buildChip, buildSeverityChip, 
      buildTypeChip, buildQueueChip, buildImpactChip,
      buildAssigneeChip, buildDateChip, 
      buildParticipantsChip, buildChangeValue,
      buildVerificationEmailHtml, buildPasswordResetEmailHtml,
      buildPulseVerificationEmailHtml,
    } = require('./common/email-builder');

    let html = '';

    if (type === 'verification') {
      html = buildVerificationEmailHtml({
        verificationCode: '849201',
        expiryMinutes: 15,
      });
    } else if (type === 'password-reset') {
      html = buildPasswordResetEmailHtml({
        firstName: 'Alex',
        resetLink: 'https://app.synlio.com/reset-password?token=sample-reset-token-12345',
        expiryHours: 1,
      });
    } else if (type === 'pulse' || type === 'pulse-verification') {
      html = buildPulseVerificationEmailHtml({
        actorName: 'Kasun Ariyasinghe',
        actorInitials: 'KA',
        message: 'Hi, please review and approve this weekly pulse snapshot.',
        reviewUrl: 'https://app.synlio.com/pulse/review?sample=1',
      });
    } else {
      html = buildEmailHtml({
        breadcrumb: 'Synlio Project Space / SPS-P4',
        title: 'Synlio self registration & licensing',
        actorInitials: 'JD',
        actorName: 'John Doe',
        actionSentence: '<strong>John Doe</strong> updated this project',
        description: 'Self-registration flow completed. Please review the updated tenant provisioning pipeline before triggering automated production rollout.',
        metaRows: [
          {
            label: 'Status',
            valueHtml: buildChangeValue(
              buildChip('To Do', '#94a3b8', { muted: true }),
              buildChip('In Progress', '#0ea5e9')
            ),
          },
          {
            label: 'Severity',
            valueHtml: buildChangeValue(
              buildSeverityChip('Medium', '#94a3b8', { muted: true }),
              buildSeverityChip('Low', '#10b981')
            ),
          },
          {
            label: 'Type',
            valueHtml: buildChangeValue(
              buildTypeChip('Task', { muted: true }),
              buildTypeChip('Feature')
            ),
          },
          {
            label: 'Queue',
            valueHtml: buildChangeValue(
              buildQueueChip('General', { muted: true }),
              buildQueueChip('Product Dev')
            ),
          },
          {
            label: 'Impact',
            valueHtml: buildChangeValue(
              buildImpactChip('Minor', { muted: true }),
              buildImpactChip('Significant')
            ),
          },
          {
            label: 'Timeline',
            valueHtml: buildChangeValue(
              buildDateChip('Sep 15 – Sep 28', { muted: true }),
              buildDateChip('Sep 28 – Oct 09', { alert: true })
            ),
          },
          {
            label: 'Assignee',
            valueHtml: buildChangeValue(
              buildAssigneeChip('Bob Dylan', null, { muted: true, bgColor: '#94a3b8' }),
              buildAssigneeChip('Alice Smith', null, { bgColor: '#0ea5e9' })
            ),
          },
          {
            label: 'Participants',
            valueHtml: buildChangeValue(
              buildParticipantsChip('Alice Smith', { muted: true }),
              buildParticipantsChip('Alice Smith, John Doe')
            ),
          },
        ],
        ctaUrl: 'https://app.synlio.com',
        ctaLabel: 'View in Synlio',
      });
    }

    return this.injectPreviewToolbar(html, type || 'alert');
  }

  private injectPreviewToolbar(html: string, currentType: string): string {
    const isAlert = !currentType || currentType === 'alert';
    const isVerif = currentType === 'verification';
    const isReset = currentType === 'password-reset';
    const isPulse = currentType === 'pulse' || currentType === 'pulse-verification';

    const toolbar = `
      <style>
        body { padding-top: 76px !important; }
      </style>
      <div id="synlio-preview-toolbar" style="
        position: fixed;
        top: 14px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 999999;
        background: rgba(11, 19, 41, 0.92);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 9999px;
        padding: 6px 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0,0,0,0.2);
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        user-select: none;
      ">
        <span style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:#38bdf8;padding-right:8px;border-right:1px solid rgba(255,255,255,0.15);letter-spacing:0.06em;">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#0ea5e9;box-shadow:0 0 8px #38bdf8;"></span>
          PREVIEW
        </span>

        <div style="display:flex;gap:4px;">
          <a href="/email-preview" style="padding:5px 12px;border-radius:9999px;font-size:12px;font-weight:500;text-decoration:none;transition:all 0.15s;${isAlert ? 'background:#0ea5e9;color:#ffffff;font-weight:600;' : 'color:#94a3b8;'}">Alert Notification</a>
          <a href="/email-preview?type=verification" style="padding:5px 12px;border-radius:9999px;font-size:12px;font-weight:500;text-decoration:none;transition:all 0.15s;${isVerif ? 'background:#0ea5e9;color:#ffffff;font-weight:600;' : 'color:#94a3b8;'}">Verification Code</a>
          <a href="/email-preview?type=password-reset" style="padding:5px 12px;border-radius:9999px;font-size:12px;font-weight:500;text-decoration:none;transition:all 0.15s;${isReset ? 'background:#0ea5e9;color:#ffffff;font-weight:600;' : 'color:#94a3b8;'}">Password Reset</a>
          <a href="/email-preview?type=pulse" style="padding:5px 12px;border-radius:9999px;font-size:12px;font-weight:500;text-decoration:none;transition:all 0.15s;${isPulse ? 'background:#0ea5e9;color:#ffffff;font-weight:600;' : 'color:#94a3b8;'}">Pulse Verification</a>
        </div>

        <span style="height:16px;width:1px;background:rgba(255,255,255,0.15);margin:0 2px;"></span>

        <button id="toggle-viewport" onclick="toggleViewport()" title="Toggle Viewport Width (Desktop / Mobile)" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:#cbd5e1;padding:5px 10px;border-radius:9999px;font-size:12px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:4px;transition:all 0.15s;">
          <span id="viewport-icon">🖥️</span> <span id="viewport-label">600px</span>
        </button>

        <span style="height:16px;width:1px;background:rgba(255,255,255,0.15);margin:0 2px;"></span>

        <button id="theme-toggle-btn" onclick="toggleTheme()" style="background:#0ea5e9;border:none;color:#ffffff;padding:5px 12px;border-radius:9999px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;box-shadow:0 2px 8px rgba(14,165,233,0.35);transition:all 0.15s;">
          <span id="theme-icon">🌙</span> <span id="theme-label">Dark Mode</span>
        </button>
      </div>

      <script>
        (function() {
          var saved = localStorage.getItem('synlio_email_preview_theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
          applyTheme(saved);

          var isMobile = false;

          window.toggleTheme = function() {
            var isDark = document.body.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark';
            var next = isDark ? 'light' : 'dark';
            localStorage.setItem('synlio_email_preview_theme', next);
            applyTheme(next);
          };

          function applyTheme(theme) {
            var btn = document.getElementById('theme-toggle-btn');
            var icon = document.getElementById('theme-icon');
            var label = document.getElementById('theme-label');
            if (theme === 'dark') {
              document.documentElement.classList.add('dark');
              document.documentElement.classList.remove('light');
              document.documentElement.setAttribute('data-theme', 'dark');
              document.body.classList.add('dark');
              document.body.classList.remove('light');
              document.body.setAttribute('data-theme', 'dark');
              if (icon) icon.innerText = '☀️';
              if (label) label.innerText = 'Light Mode';
              if (btn) { btn.style.background = '#1e293b'; btn.style.color = '#f8fafc'; btn.style.border = '1px solid #334155'; }
            } else {
              document.documentElement.classList.add('light');
              document.documentElement.classList.remove('dark');
              document.documentElement.setAttribute('data-theme', 'light');
              document.body.classList.add('light');
              document.body.classList.remove('dark');
              document.body.setAttribute('data-theme', 'light');
              if (icon) icon.innerText = '🌙';
              if (label) label.innerText = 'Dark Mode';
              if (btn) { btn.style.background = '#0ea5e9'; btn.style.color = '#ffffff'; btn.style.border = 'none'; }
            }
          }

          window.toggleViewport = function() {
            isMobile = !isMobile;
            var wrapper = document.querySelector('.wrapper');
            var label = document.getElementById('viewport-label');
            var icon = document.getElementById('viewport-icon');
            if (wrapper) {
              if (isMobile) {
                wrapper.style.maxWidth = '375px';
                wrapper.classList.add('mobile-view');
                document.body.classList.add('mobile-view');
                if (label) label.innerText = '375px (Mobile)';
                if (icon) icon.innerText = '📱';
              } else {
                wrapper.style.maxWidth = '600px';
                wrapper.classList.remove('mobile-view');
                document.body.classList.remove('mobile-view');
                if (label) label.innerText = '600px (Desktop)';
                if (icon) icon.innerText = '🖥️';
              }
            }
          };
        })();
      </script>
    `;

    return html.replace('</body>', `${toolbar}</body>`);
  }
}
