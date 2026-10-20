import * as vscode from 'vscode';
import { getJwtGlanceSetting } from './configHelper';

/**
 * Manages the status bar item in the editor footer to display
 * the ambient inspection state and allow quick 1-click toggling.
 */
export class JwtStatusBarItem implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.command = 'jwtGlance.toggleEnabled';
    this.update();
  }

  /**
   * Refreshes status bar item text, tooltip, and visibility
   * according to current workspace configuration.
   */
  public update(): void {
    const show = getJwtGlanceSetting('showStatusBarItem', true, vscode);

    if (!show) {
      this.item.hide();
      return;
    }

    const enabled = getJwtGlanceSetting('enabled', true, vscode);
    if (enabled) {
      this.item.text = '$(jwt-glance)';
      this.item.tooltip = 'JWT Glance: Ambient inspection is active (click to pause)';
      this.item.backgroundColor = undefined;
    } else {
      this.item.text = '$(jwt-glance-paused)';
      this.item.tooltip = 'JWT Glance: Ambient inspection is paused (click to resume)';
      this.item.backgroundColor = undefined;
    }

    this.item.show();
  }

  public dispose(): void {
    this.item.dispose();
  }
}
