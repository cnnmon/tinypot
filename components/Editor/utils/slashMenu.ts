import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';

// Menu items based on the help page syntax
export interface MenuItem {
  label: string;
  description: string;
  template: string;
  symbol: string;
  symbolColor: string;
  category: 'scene' | 'choice' | 'condition' | 'variable' | 'navigation' | 'other';
}

export const menuItems: MenuItem[] = [
  // Scenes
  {
    label: 'Scene',
    description: 'Create a new scene',
    template: '@SCENE_NAME\n',
    symbol: '@',
    symbolColor: '#8B5CF6',
    category: 'scene',
  },
  {
    label: 'Scene (new only)',
    description: 'Scene allowing new scenes',
    template: '@SCENE_NAME [allows: new]\n',
    symbol: '@',
    symbolColor: '#8B5CF6',
    category: 'scene',
  },
  {
    label: 'Scene (link only)',
    description: 'Scene allowing only existing scenes',
    template: '@SCENE_NAME [allows: link]\n',
    symbol: '@',
    symbolColor: '#8B5CF6',
    category: 'scene',
  },
  {
    label: 'Scene (text only)',
    description: 'Scene allowing flavor text only',
    template: '@SCENE_NAME [allows: text]\n',
    symbol: '@',
    symbolColor: '#8B5CF6',
    category: 'scene',
  },
  
  // Choices
  {
    label: 'Choice',
    description: 'Define a player choice',
    template: 'if action\n\t',
    symbol: '?',
    symbolColor: '#3B82F6',
    category: 'choice',
  },
  {
    label: 'Choice with synonyms',
    description: 'Choice with multiple synonyms',
    template: 'if action | synonym1 | synonym2\n\t',
    symbol: '?',
    symbolColor: '#3B82F6',
    category: 'choice',
  },
  {
    label: 'Choice with requirement',
    description: 'Choice requiring a variable',
    template: 'if action & ?variable\n\t',
    symbol: '?',
    symbolColor: '#3B82F6',
    category: 'choice',
  },
  
  // Navigation
  {
    label: 'Go to scene',
    description: 'Navigate to another scene',
    template: 'goto @SCENE_NAME',
    symbol: '→',
    symbolColor: '#10B981',
    category: 'navigation',
  },
  
  // Variables
  {
    label: 'Increment variable',
    description: 'Add 1 to a variable',
    template: '+variable',
    symbol: '+',
    symbolColor: '#F59E0B',
    category: 'variable',
  },
  {
    label: 'Decrement variable',
    description: 'Subtract 1 from a variable',
    template: '-variable',
    symbol: '−',
    symbolColor: '#EF4444',
    category: 'variable',
  },
  
  // Conditions
  {
    label: 'When (has variable)',
    description: 'Show if variable >= 1',
    template: 'when variable\n\t',
    symbol: '◆',
    symbolColor: '#06B6D4',
    category: 'condition',
  },
  {
    label: 'When (no variable)',
    description: 'Show if variable = 0',
    template: 'when !variable\n\t',
    symbol: '◇',
    symbolColor: '#06B6D4',
    category: 'condition',
  },
  {
    label: 'When (threshold)',
    description: 'Show if variable >= N',
    template: 'when variable >= N\n\t',
    symbol: '◆',
    symbolColor: '#06B6D4',
    category: 'condition',
  },
  
  // Other
  {
    label: 'Image',
    description: 'Add an image',
    template: '[image: https://example.com/image.png]',
    symbol: '▢',
    symbolColor: '#EC4899',
    category: 'other',
  },
];

// State effects for menu control
export const toggleSlashMenu = StateEffect.define<{ show: boolean; pos: number; query: string }>();
export const setMenuSelection = StateEffect.define<number>();

// State field to track menu visibility, position, and selection
export const slashMenuState = StateField.define<{ show: boolean; pos: number; query: string; selectedIndex: number }>({
  create: () => ({ show: false, pos: 0, query: '', selectedIndex: 0 }),
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(toggleSlashMenu)) {
        return { ...effect.value, selectedIndex: 0 };
      }
      if (effect.is(setMenuSelection)) {
        return { ...value, selectedIndex: effect.value };
      }
    }
    return value;
  },
});

// Widget to render the menu
class SlashMenuWidget extends WidgetType {
  constructor(
    readonly query: string,
    readonly selectedIndex: number,
    readonly onSelect: (item: MenuItem) => void,
    readonly onClose: () => void
  ) {
    super();
  }

  eq(other: SlashMenuWidget) {
    return other.query === this.query && other.selectedIndex === this.selectedIndex;
  }

  toDOM() {
    const wrapper = document.createElement('div');
    wrapper.className = 'slash-menu-wrapper';
    
    const menu = document.createElement('div');
    menu.className = 'slash-menu';
    
    // Filter items based on query
    const filteredItems = this.query
      ? menuItems.filter(
          (item) =>
            item.label.toLowerCase().includes(this.query.toLowerCase()) ||
            item.description.toLowerCase().includes(this.query.toLowerCase())
        )
      : menuItems;
    
    if (filteredItems.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'slash-menu-item slash-menu-empty';
      noResults.textContent = 'No results';
      menu.appendChild(noResults);
    } else {
      filteredItems.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = `slash-menu-item ${index === this.selectedIndex ? 'slash-menu-item-selected' : ''}`;
        
        const symbolEl = document.createElement('div');
        symbolEl.className = 'slash-menu-item-symbol';
        symbolEl.textContent = item.symbol;
        symbolEl.style.color = item.symbolColor;
        
        const contentEl = document.createElement('div');
        contentEl.className = 'slash-menu-item-content';
        
        const labelEl = document.createElement('div');
        labelEl.className = 'slash-menu-item-label';
        labelEl.textContent = item.label;
        
        const descEl = document.createElement('div');
        descEl.className = 'slash-menu-item-desc';
        descEl.textContent = item.description;
        
        contentEl.appendChild(labelEl);
        contentEl.appendChild(descEl);
        
        itemEl.appendChild(symbolEl);
        itemEl.appendChild(contentEl);
        
        itemEl.addEventListener('mousedown', (e) => {
          e.preventDefault();
          this.onSelect(item);
        });
        
        menu.appendChild(itemEl);
      });
    }
    
    wrapper.appendChild(menu);
    return wrapper;
  }

  ignoreEvent(event: Event): boolean {
    return event.type !== 'mousedown';
  }
}

// Plugin to handle slash menu
export const slashMenuPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;
    
    constructor(readonly view: EditorView) {
      this.update();
    }

    update(update?: ViewUpdate) {
      const menuState = this.view.state.field(slashMenuState);
      
      if (!menuState.show) {
        this.decorations = Decoration.none;
        return;
      }

      const filteredItems = menuState.query
        ? menuItems.filter(
            (item) =>
              item.label.toLowerCase().includes(menuState.query.toLowerCase()) ||
              item.description.toLowerCase().includes(menuState.query.toLowerCase())
          )
        : menuItems;

      const widget = Decoration.widget({
        widget: new SlashMenuWidget(
          menuState.query,
          menuState.selectedIndex,
          (item) => this.selectItem(item),
          () => this.closeMenu()
        ),
        side: 1,
      });

      this.decorations = Decoration.set([widget.range(menuState.pos)]);
    }

    selectItem(item: MenuItem) {
      const menuState = this.view.state.field(slashMenuState);
      const slashPos = menuState.pos - 1; // Position of the '/'
      
      // Replace from '/' to current position with the template
      this.view.dispatch({
        changes: { from: slashPos, to: this.view.state.selection.main.head, insert: item.template },
        effects: toggleSlashMenu.of({ show: false, pos: 0, query: '' }),
      });
      
      this.view.focus();
    }

    closeMenu() {
      this.view.dispatch({
        effects: toggleSlashMenu.of({ show: false, pos: 0, query: '' }),
      });
    }

    moveSelection(delta: number) {
      const menuState = this.view.state.field(slashMenuState);
      const filteredItems = menuState.query
        ? menuItems.filter(
            (item) =>
              item.label.toLowerCase().includes(menuState.query.toLowerCase()) ||
              item.description.toLowerCase().includes(menuState.query.toLowerCase())
          )
        : menuItems;

      if (filteredItems.length === 0) return;
      
      const newIndex = (menuState.selectedIndex + delta + filteredItems.length) % filteredItems.length;
      
      this.view.dispatch({
        effects: setMenuSelection.of(newIndex),
      });
    }

    selectCurrent() {
      const menuState = this.view.state.field(slashMenuState);
      const filteredItems = menuState.query
        ? menuItems.filter(
            (item) =>
              item.label.toLowerCase().includes(menuState.query.toLowerCase()) ||
              item.description.toLowerCase().includes(menuState.query.toLowerCase())
          )
        : menuItems;

      if (filteredItems.length > 0 && menuState.selectedIndex < filteredItems.length) {
        this.selectItem(filteredItems[menuState.selectedIndex]);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

// Keymap for handling slash menu interactions
export const slashMenuKeymap = EditorView.domEventHandlers({
  keydown(event, view) {
    const menuState = view.state.field(slashMenuState);
    
    if (menuState.show) {
      const plugin = view.plugin(slashMenuPlugin);
      
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        plugin?.moveSelection(1);
        return true;
      }
      
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        plugin?.moveSelection(-1);
        return true;
      }
      
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        plugin?.selectCurrent();
        return true;
      }
      
      if (event.key === 'Escape') {
        event.preventDefault();
        plugin?.closeMenu();
        return true;
      }
    }
    
    // Detect '/' typed at start of line or after whitespace
    if (event.key === '/') {
      const pos = view.state.selection.main.head;
      const line = view.state.doc.lineAt(pos);
      const textBeforeCursor = line.text.slice(0, pos - line.from);
      
      // Show menu if at start of line or after whitespace
      if (textBeforeCursor.trim() === '') {
        // Wait for the '/' to be inserted
        setTimeout(() => {
          view.dispatch({
            effects: toggleSlashMenu.of({ show: true, pos: view.state.selection.main.head, query: '' }),
          });
        }, 0);
      }
    }
    
    return false;
  },
  
  input(event, view) {
    const menuState = view.state.field(slashMenuState);
    
    if (menuState.show) {
      // Update query as user types
      const pos = view.state.selection.main.head;
      const line = view.state.doc.lineAt(pos);
      const textBeforeCursor = line.text.slice(0, pos - line.from);
      
      // Find the '/' and extract query
      const slashIndex = textBeforeCursor.lastIndexOf('/');
      if (slashIndex !== -1) {
        const query = textBeforeCursor.slice(slashIndex + 1);
        
        // Reset selection to 0 when query changes
        view.dispatch({
          effects: [
            toggleSlashMenu.of({ show: true, pos: menuState.pos, query }),
            setMenuSelection.of(0)
          ],
        });
      } else {
        // '/' was deleted, close menu
        view.dispatch({
          effects: toggleSlashMenu.of({ show: false, pos: 0, query: '' }),
        });
      }
    }
    
    return false;
  },
  
  blur(event, view) {
    const menuState = view.state.field(slashMenuState);
    if (menuState.show) {
      // Close menu when editor loses focus (but not immediately to allow click)
      setTimeout(() => {
        view.dispatch({
          effects: toggleSlashMenu.of({ show: false, pos: 0, query: '' }),
        });
      }, 200);
    }
    return false;
  },
});

