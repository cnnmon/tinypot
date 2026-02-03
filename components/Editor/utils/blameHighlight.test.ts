import { describe, expect, it } from 'vitest';
import { Entity } from '@/types/entities';
import { EditorState } from '@codemirror/state';
import {
  blameHighlightState,
  BlameState,
  clearBlameHighlight,
  markLineReviewed,
  setBlameHighlight,
} from './blameHighlight';

describe('blameHighlight state management', () => {
  // Helper to create an editor state with blame highlighting
  const createState = (initialBlame: BlameState['blame'] = []) => {
    return EditorState.create({
      doc: 'line1\nline2\nline3',
      extensions: [blameHighlightState],
    });
  };

  describe('setBlameHighlight', () => {
    it('should set initial blame data', () => {
      let state = createState();
      
      const blame = [Entity.AUTHOR, Entity.SYSTEM, null];
      state = state.update({
        effects: setBlameHighlight.of({ blame }),
      }).state;

      const blameState = state.field(blameHighlightState);
      expect(blameState.blame).toEqual(blame);
      expect(blameState.showHighlighting).toBe(true);
      expect(blameState.reviewedLines.size).toBe(0);
    });

    it('should preserve reviewedLines when updating blame', () => {
      let state = createState();
      
      // Set initial blame
      state = state.update({
        effects: setBlameHighlight.of({ 
          blame: [Entity.SYSTEM, Entity.SYSTEM, null],
          reviewedLines: new Set([0]),
        }),
      }).state;

      // Update blame without reviewedLines
      state = state.update({
        effects: setBlameHighlight.of({ 
          blame: [Entity.SYSTEM, Entity.AUTHOR, null],
        }),
      }).state;

      const blameState = state.field(blameHighlightState);
      // reviewedLines should be preserved
      expect(blameState.reviewedLines.has(0)).toBe(true);
    });
  });

  describe('markLineReviewed', () => {
    it('should mark a line as reviewed (yellow → green)', () => {
      let state = createState();
      
      // Set blame with AI lines
      state = state.update({
        effects: setBlameHighlight.of({ 
          blame: [Entity.AUTHOR, Entity.SYSTEM, Entity.SYSTEM],
        }),
      }).state;

      // Mark line 1 as reviewed (author edited it)
      state = state.update({
        effects: markLineReviewed.of(1),
      }).state;

      const blameState = state.field(blameHighlightState);
      expect(blameState.reviewedLines.has(1)).toBe(true);
      expect(blameState.reviewedLines.has(2)).toBe(false); // Not reviewed yet
    });

    it('should accumulate multiple reviewed lines', () => {
      let state = createState();
      
      state = state.update({
        effects: setBlameHighlight.of({ 
          blame: [Entity.SYSTEM, Entity.SYSTEM, Entity.SYSTEM],
        }),
      }).state;

      // Author edits multiple AI lines
      state = state.update({
        effects: markLineReviewed.of(0),
      }).state;
      state = state.update({
        effects: markLineReviewed.of(2),
      }).state;

      const blameState = state.field(blameHighlightState);
      expect(blameState.reviewedLines.has(0)).toBe(true);
      expect(blameState.reviewedLines.has(1)).toBe(false);
      expect(blameState.reviewedLines.has(2)).toBe(true);
    });
  });

  describe('clearBlameHighlight', () => {
    it('should hide all highlighting when dismissed', () => {
      let state = createState();
      
      state = state.update({
        effects: setBlameHighlight.of({ 
          blame: [Entity.SYSTEM, Entity.SYSTEM, Entity.SYSTEM],
          reviewedLines: new Set([0]),
        }),
      }).state;

      // Dismiss highlights
      state = state.update({
        effects: clearBlameHighlight.of(),
      }).state;

      const blameState = state.field(blameHighlightState);
      expect(blameState.showHighlighting).toBe(false);
      // Blame data is preserved, just not shown
      expect(blameState.blame.length).toBe(3);
    });
  });

  describe('highlighting behavior', () => {
    it('should show yellow for AI lines not yet reviewed', () => {
      let state = createState();
      
      state = state.update({
        effects: setBlameHighlight.of({ 
          blame: [Entity.AUTHOR, Entity.SYSTEM, Entity.SYSTEM],
        }),
      }).state;

      const blameState = state.field(blameHighlightState);
      
      // Line 1 and 2 are AI (SYSTEM)
      expect(blameState.blame[1]).toBe(Entity.SYSTEM);
      expect(blameState.blame[2]).toBe(Entity.SYSTEM);
      
      // Neither is reviewed yet
      expect(blameState.reviewedLines.has(1)).toBe(false);
      expect(blameState.reviewedLines.has(2)).toBe(false);
      
      // Both would be yellow (AI, not reviewed)
    });

    it('should show green for AI lines that author has edited', () => {
      let state = createState();
      
      state = state.update({
        effects: setBlameHighlight.of({ 
          blame: [Entity.AUTHOR, Entity.SYSTEM, Entity.SYSTEM],
        }),
      }).state;

      // Author edits line 1 (which was AI)
      state = state.update({
        effects: markLineReviewed.of(1),
      }).state;

      const blameState = state.field(blameHighlightState);
      
      // Line 1 is AI but reviewed → green
      expect(blameState.blame[1]).toBe(Entity.SYSTEM);
      expect(blameState.reviewedLines.has(1)).toBe(true);
      
      // Line 2 is AI but not reviewed → yellow
      expect(blameState.blame[2]).toBe(Entity.SYSTEM);
      expect(blameState.reviewedLines.has(2)).toBe(false);
    });
  });
});
