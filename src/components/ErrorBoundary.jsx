import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('PDF Viewer Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div className="error-boundary">PDF查看器出现错误，请刷新页面重试</div>;
    }
    return this.props.children;
  }
}

export default ErrorBoundary; 