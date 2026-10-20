/**
 * Standardized Synlio Email Badges & Components
 * Matches the frontend UI patterns in synlio-front-end:
 * - Status pills with colored dots
 * - Lucide Flag severity badges
 * - Tag (Ticket Type), FolderClosed (Queue), Target (Impact) badges
 * - Calendar date badges (red border/icon ONLY if overdue)
 * - 24-28px UserAvatar with initials (white in light, black in dark)
 * - AvatarGroup overlapping participants / text list
 */

export const FLAG_GLYPH = '&#9873;';
export const CALENDAR_GLYPH = '&#128197;';

/**
 * Wraps an inline SVG so Outlook desktop gets a usable fallback glyph.
 */
export function withMsoIconFallback(
  svg: string,
  msoGlyph?: string,
  glyphStyle = '',
): string {
  const msoBranch = msoGlyph
    ? `<!--[if mso]><span style="${glyphStyle}">${msoGlyph}</span><![endif]-->`
    : '';
  return `${msoBranch}<!--[if !mso]><!--><span class="chip-icon">${svg}</span><!--<![endif]-->`;
}

const CHIP_BASE_STYLE = "display:inline-block;padding:2px 9px;border-radius:6px;font-size:12px;font-weight:500;line-height:18px;background-color:#ffffff;color:#334155;border:1px solid #e2e8f0;font-family:'Plus Jakarta Sans',sans-serif;vertical-align:middle;box-shadow:0 1px 2px rgba(0,0,0,0.03);";
const CHIP_MUTED_STYLE = "display:inline-block;padding:2px 9px;border-radius:6px;font-size:12px;font-weight:500;line-height:18px;background-color:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;font-family:'Plus Jakarta Sans',sans-serif;vertical-align:middle;opacity:0.7;";

/**
 * Builds a status badge matching frontend InlineEditableStatus:
 * rounded-md (6px), subtle border, 8px colored dot.
 */
export function buildChip(
  name?: string | null,
  color?: string | null,
  options?: { muted?: boolean; hideDot?: boolean; icon?: 'dot' | 'flag' | string },
): string {
  if (!name || name === '—') return '<span style="color:#94a3b8;">—</span>';
  if (options?.icon === 'flag') {
    return buildSeverityChip(name, color, { muted: options?.muted });
  }
  const iconColor = color || '#0ea5e9';
  const cls = options?.muted ? 'chip chip-muted' : 'chip';
  const dotHtml = options?.hideDot
    ? ''
    : `<span class="chip-dot" style="display:inline-block;vertical-align:middle;width:7px;height:7px;border-radius:50%;margin-right:6px;background-color:${iconColor};"></span>`;
  const style = options?.muted ? CHIP_MUTED_STYLE : CHIP_BASE_STYLE;
  return `<span class="${cls}" style="${style}">${dotHtml}<span class="chip-text">${name}</span></span>`;
}

/**
 * Builds a severity badge matching frontend InlineEditableSeverity:
 * rounded-md (6px), subtle border, Lucide Flag icon matching frontend severity color.
 */
export function buildSeverityChip(
  name?: string | null,
  color?: string | null,
  options?: { muted?: boolean },
): string {
  if (!name || name === '—') return '<span style="color:#94a3b8;">—</span>';
  const flagColor = color || '#10b981';
  const cls = options?.muted ? 'chip chip-muted' : 'chip';
  const svgFlag = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="${flagColor}" stroke="${flagColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>`;
  const flag = withMsoIconFallback(svgFlag, FLAG_GLYPH, `color:${flagColor};font-size:12px;line-height:1;vertical-align:middle;margin-right:4px;`);
  const style = options?.muted ? CHIP_MUTED_STYLE : CHIP_BASE_STYLE;
  return `<span class="${cls}" style="${style}">${flag}<span class="chip-text">${name}</span></span>`;
}

/**
 * Builds a ticket type badge matching frontend InlineEditableTicketType:
 * rounded-md (6px), subtle border, Lucide Tag icon.
 */
export function buildTypeChip(
  name: string,
  options?: { muted?: boolean; color?: string },
): string {
  if (!name || name === '—') return '<span style="color:#94a3b8;">—</span>';
  const cls = options?.muted ? 'chip chip-muted' : 'chip';
  const iconColor = options?.color || 'currentColor';
  const svgTag = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><circle cx="7" cy="7" r=".5" fill="currentColor"/></svg>`;
  const icon = withMsoIconFallback(svgTag);
  const style = options?.muted ? CHIP_MUTED_STYLE : CHIP_BASE_STYLE;
  return `<span class="${cls}" style="${style}">${icon}<span class="chip-text">${name}</span></span>`;
}

/**
 * Builds a queue / dept badge matching frontend InlineEditableQueue:
 * rounded-md (6px), subtle border, Lucide FolderClosed icon.
 */
export function buildQueueChip(
  name: string,
  options?: { muted?: boolean; color?: string },
): string {
  if (!name || name === '—') return '<span style="color:#94a3b8;">—</span>';
  const cls = options?.muted ? 'chip chip-muted' : 'chip';
  const iconColor = options?.color || 'currentColor';
  const svgFolder = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M2 10h20"/></svg>`;
  const icon = withMsoIconFallback(svgFolder);
  const style = options?.muted ? CHIP_MUTED_STYLE : CHIP_BASE_STYLE;
  return `<span class="${cls}" style="${style}">${icon}<span class="chip-text">${name}</span></span>`;
}

/**
 * Builds an impact badge matching frontend InlineEditableImpact:
 * rounded-md (6px), subtle border, Lucide Target icon.
 */
export function buildImpactChip(
  name: string,
  options?: { muted?: boolean; color?: string },
): string {
  if (!name || name === '—') return '<span style="color:#94a3b8;">—</span>';
  const cls = options?.muted ? 'chip chip-muted' : 'chip';
  const iconColor = options?.color || 'currentColor';
  const svgTarget = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`;
  const icon = withMsoIconFallback(svgTarget);
  const style = options?.muted ? CHIP_MUTED_STYLE : CHIP_BASE_STYLE;
  return `<span class="${cls}" style="${style}">${icon}<span class="chip-text">${name}</span></span>`;
}

/**
 * Builds a date chip matching frontend date display with Lucide Calendar icon.
 *
 * CRITICAL RULE:
 * Red border and red calendar icon should show ONLY IF OVERDUE (alert or isOverdue is true).
 * Otherwise, renders with standard neutral border and muted calendar icon.
 */
export function buildDateChip(
  dateStr: string,
  options?: { muted?: boolean; alert?: boolean; isOverdue?: boolean },
): string {
  if (!dateStr || dateStr === '—') return '<span style="color:#94a3b8;">—</span>';
  const isOverdue = options?.alert || options?.isOverdue;

  if (isOverdue) {
    const calendarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`;
    const cls = options?.muted ? 'chip chip-date-alert chip-muted' : 'chip chip-date-alert';
    const finalSvg = withMsoIconFallback(calendarSvg, CALENDAR_GLYPH, 'color:#ef4444;font-size:12px;margin-right:4px;');
    const overdueStyle = `display:inline-block;padding:2px 9px;border-radius:6px;font-size:12px;font-weight:500;line-height:18px;background-color:transparent;color:#0f172a;border:1px solid #ef4444;font-family:'Plus Jakarta Sans',sans-serif;vertical-align:middle;${options?.muted ? 'opacity:0.7;' : ''}`;
    return `<span class="${cls}" style="${overdueStyle}">${finalSvg}<span class="chip-text">${dateStr}</span></span>`;
  }

  // Standard non-overdue date badge: neutral border and muted icon
  const calendarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`;
  const cls = options?.muted ? 'chip chip-muted' : 'chip';
  const finalSvg = withMsoIconFallback(calendarSvg, CALENDAR_GLYPH, 'color:#64748b;font-size:12px;margin-right:4px;');
  const normalStyle = options?.muted ? CHIP_MUTED_STYLE : CHIP_BASE_STYLE;
  return `<span class="${cls}" style="${normalStyle}">${finalSvg}<span class="chip-text">${dateStr}</span></span>`;
}

/**
 * Builds an assignee element matching the frontend UserAvatar:
 * 28px circular avatar with profile image or initials.
 * In Dark Mode, initials render crisp black against colored background.
 */
export function buildAssigneeChip(
  name: string,
  picUrl?: string | null,
  options?: { muted?: boolean; bgColor?: string },
): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  const initials = parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
  const bg = options?.bgColor || (options?.muted ? '#94a3b8' : '#0ea5e9');
  const opacity = options?.muted ? 'opacity:0.6;' : '';

  const avatarHtml = picUrl
    ? `<img class="user-avatar-img avatar" src="${picUrl}" width="28" height="28" style="display:inline-block;vertical-align:middle;width:28px;height:28px;border-radius:50%;object-fit:cover;" />`
    : `<span class="user-avatar-initials avatar" style="display:inline-block;vertical-align:middle;width:28px;height:28px;border-radius:50%;background-color:${bg};color:#ffffff;font-size:11px;font-weight:700;line-height:28px;text-align:center;font-family:'Plus Jakarta Sans',sans-serif;">${initials}</span>`;

  return `<span style="display:inline-block;font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;font-weight:500;${opacity}">${avatarHtml}<span class="user-name" style="display:inline-block;vertical-align:middle;margin-left:8px;color:#0f172a;">${name}</span></span>`;
}

/**
 * Builds a participants chip matching frontend text layout:
 * e.g., "Alice Smith, John Doe"
 */
export function buildParticipantsChip(
  participants: string[] | string,
  options?: { muted?: boolean },
): string {
  const text = Array.isArray(participants) ? participants.join(', ') : participants;
  if (!text) return '<span style="color:#94a3b8;">—</span>';
  const opacity = options?.muted ? 'opacity:0.6;' : '';
  return `<span class="participants-text" style="display:inline-block;font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;font-weight:500;${opacity}">${text}</span>`;
}

/**
 * Builds a generic icon chip.
 */
export function buildIconChip(
  name: string,
  iconSvg: string,
  options?: { muted?: boolean; iconColor?: string },
): string {
  if (!name || name === '—') return '<span style="color:#94a3b8;">—</span>';
  const cls = options?.muted ? 'chip chip-muted' : 'chip';
  const coloredSvg = options?.iconColor
    ? `<span style="color:${options.iconColor};">${iconSvg}</span>`
    : iconSvg;
  const finalSvg = withMsoIconFallback(coloredSvg);
  return `<span class="${cls}">${finalSvg}<span class="chip-text">${name}</span></span>`;
}

/**
 * Builds a co-assignees element matching frontend overlapping avatars.
 */
export function buildCoAssigneesChip(
  assignees: { name: string; picUrl?: string | null }[],
): string {
  if (!assignees || assignees.length === 0) return '<span style="color:#94a3b8;">—</span>';

  let avatarsHtml = '';
  const visible = assignees.slice(0, 3);
  visible.forEach((a, i) => {
    const initials = a.name.substring(0, 2).toUpperCase();
    const style = `display:inline-block;vertical-align:middle;width:24px;height:24px;border-radius:50%;border:2px solid #ffffff;${i > 0 ? 'margin-left:-6px;' : ''}`;
    if (a.picUrl) {
      avatarsHtml += `<img class="co-avatar-img" src="${a.picUrl}" width="24" height="24" style="${style}object-fit:cover;" title="${a.name}" />`;
    } else {
      avatarsHtml += `<span class="co-avatar-initials" style="${style}background:#0ea5e9;color:#ffffff;font-size:9px;font-weight:700;line-height:20px;text-align:center;font-family:'Plus Jakarta Sans',sans-serif;" title="${a.name}">${initials}</span>`;
    }
  });

  return `<span style="display:inline-block;font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;"><span class="avatar-group-wrap">${avatarsHtml}</span><span class="co-count" style="display:inline-block;vertical-align:middle;margin-left:8px;font-weight:500;font-size:12px;">${assignees.length} Assignee${assignees.length !== 1 ? 's' : ''}</span></span>`;
}

/**
 * Renders an "old → new" pair as a small table row so it lays out correctly without flexbox.
 */
export function buildChangeValue(
  oldHtml: string,
  newHtml: string,
): string {
  const arrow = '<span class="change-arrow" style="color:#94a3b8;font-size:14px;line-height:1;padding:0 6px;vertical-align:middle;display:inline-block;">&rarr;</span>';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" style="border:none !important;border-collapse:collapse;display:inline-table;vertical-align:middle;margin:0;margin-left:auto;padding:0;float:right;"><tr>
    <td valign="middle" style="border:none !important;border-bottom:none !important;padding:0;vertical-align:middle;border-collapse:collapse;text-align:right;">${oldHtml}</td>
    <td valign="middle" style="border:none !important;border-bottom:none !important;padding:0 6px;vertical-align:middle;border-collapse:collapse;text-align:center;">${arrow}</td>
    <td valign="middle" style="border:none !important;border-bottom:none !important;padding:0;vertical-align:middle;border-collapse:collapse;text-align:right;">${newHtml}</td>
  </tr></table>`;
}
