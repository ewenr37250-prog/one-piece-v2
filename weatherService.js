class WeatherService {
  constructor() {
    this.regions = new Map([
      ['East Blue', { state: 'calm', wind: 1, current: 1, danger: 0.1 }],
      ['Grand Line', { state: 'tailwind', wind: 1.2, current: 1.1, danger: 0.35 }],
      ['New World', { state: 'storm', wind: 1.4, current: 1.3, danger: 0.7 }],
      ['Calm Belt', { state: 'fog', wind: 0.9, current: 0.8, danger: 0.3 }]
    ]);
  }

  getZoneWeather(region = 'East Blue') {
    return this.regions.get(region) || { state: 'calm', wind: 1, current: 1, danger: 0.1 };
  }

  getRouteModifiers(region = 'East Blue') {
    const zone = this.getZoneWeather(region);
    return {
      windModifier: zone.wind || 1,
      currentModifier: zone.current || 1,
      dangerModifier: zone.danger || 0.1,
      state: zone.state || 'calm'
    };
  }
}

module.exports = { WeatherService };
