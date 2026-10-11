import { Component } from "react";

export const webglAvailable = () => {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
};

// Catches what the stage throws while it sets up (a chunk that failed to
// load, a canvas that cannot get a context) and hands it to the page, which
// shows it as a designed state in the free area instead of a blank screen.
export class StageBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    this.props.onCatch(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
