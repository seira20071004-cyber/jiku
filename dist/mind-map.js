const svgNamespace = 'http://www.w3.org/2000/svg';

function registerDiagram() {
  if (customElements.get('jiku-mind-map')) return;
  class MindMapDiagram extends HTMLElement {
    connectedCallback() {
      this.observer = new ResizeObserver(() => this.drawConnections());
      this.observer.observe(this);
      for (const point of this.querySelectorAll('[data-map-point] > .map-node, [data-map-hub]')) {
        this.observer.observe(point);
      }
    }

    disconnectedCallback() {
      this.observer?.disconnect();
    }

    drawConnections() {
      const bounds = this.getBoundingClientRect();
      const hub = this.querySelector('[data-map-hub]').getBoundingClientRect();
      const svg = this.querySelector('svg');
      const x = hub.left - bounds.left + hub.width / 2;
      const connections = Array.from(this.querySelectorAll('[data-map-point]'), point => {
        const card = point.querySelector(':scope > .map-node') || point.firstElementChild;
        const rect = card.getBoundingClientRect();
        const upper = rect.top < hub.top;
        const startY = (upper ? hub.top : hub.bottom) - bounds.top;
        const endY = (upper ? rect.bottom : rect.top) - bounds.top;
        const endX = rect.left - bounds.left + rect.width / 2;
        const bend = startY + (endY - startY) / 2;
        const path = document.createElementNS(svgNamespace, 'path');
        path.setAttribute('d', `M${x},${startY} C${x},${bend} ${endX},${bend} ${endX},${endY}`);
        path.dataset.mapTone = point.dataset.mapTone;
        return path;
      });
      svg.replaceChildren(...connections);
    }
  }
  customElements.define('jiku-mind-map', MindMapDiagram);
}

export function mapDiagram(hub, points, {radial = false, label = ''} = {}) {
  registerDiagram();
  const upperCount = radial && points.length > 1 ? Math.ceil(points.length / 2) : 0;
  const band = items => items.length ? `<div class="map-band">${items.map(({card, tone}) =>
    `<div class="map-point" data-map-point data-map-tone="${tone}">${card}</div>`).join('')}</div>` : '';
  return `<jiku-mind-map class="map-diagram ${radial ? 'map-diagram-overview' : 'map-diagram-detail'}" role="group" aria-label="${label}">
    <svg class="map-connections" aria-hidden="true" focusable="false"></svg>
    ${band(points.slice(0, upperCount))}
    <div class="map-hub" data-map-hub>${hub}</div>
    ${band(points.slice(upperCount))}
  </jiku-mind-map>`;
}
