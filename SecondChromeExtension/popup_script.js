document.addEventListener('DOMContentLoaded', function() {
    const urlTableBody = document.getElementById('urlTableBody');
    let chart = null; // Store chart instance

    function formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    function getDomain(url) {
        return url.replace(/^(?:https?:\/\/)?(?:www\.)?([^\/]+).*$/, '$1');
    }

    function getClassification(url) {
        let h = 0;
        for (let i = 0; i < url.length; i++) {
            h = ((h << 5) - h) + url.charCodeAt(i);
            h |= 0;
        }
        const idx = Math.abs(h) % 3;
        return ['productive', 'unproductive', 'neutral'][idx];
    }

    function renderStackedChart(entries) {
        // Build per-domain times split into productive/unproductive (ignore neutral in chart)
        const ctx = document.getElementById('stackedChart');
        if (!ctx) {
            console.error('Could not find chart canvas');
            return;
        }

        const domainTotals = {}; // domain -> {productive, unproductive}
        const representativeUrl = {}; // domain -> {url, timeSpent}

        entries.forEach(([url, timeSpent]) => {
            const domain = getDomain(url);
            const cls = getClassification(url);
            if (!domainTotals[domain]) domainTotals[domain] = {productive: 0, neutral: 0, unproductive: 0};
            if (!representativeUrl[domain] || timeSpent > representativeUrl[domain].timeSpent) {
                representativeUrl[domain] = {url, timeSpent};
            }
            if (cls === 'productive') domainTotals[domain].productive += timeSpent;
            else if (cls === 'unproductive') domainTotals[domain].unproductive += timeSpent;
            else if (cls === 'neutral') domainTotals[domain].neutral += timeSpent;
        });

        const domains = Object.keys(domainTotals);
        if (domains.length === 0) {
            // nothing to show
            if (chart) { chart.destroy(); chart = null; }
            return;
        }

        // Generate a color per domain
        function colorForIndex(i) {
            const palette = [
                '#3366CC','#DC3912','#FF9900','#109618','#990099','#3B3EAC','#0099C6','#DD4477','#66AA00','#B82E2E'
            ];
            return palette[i % palette.length];
        }

        // One dataset per domain, data=[productiveTime, unproductiveTime]
        const datasets = domains.map((d, i) => ({
            label: d,
            data: [
                domainTotals[d].productive || 0,
                domainTotals[d].unproductive || 0
            ],
            backgroundColor: colorForIndex(i),
            borderWidth: 1
        }));

        const labels = ['Productive','Unproductive'];

        // Cleanup existing chart
        if (chart) { chart.destroy(); chart = null; }

        // Plugin to draw total labels above each stacked bar
        const totalsPlugin = {
            id: 'totalsPlugin',
            afterDatasetsDraw: (chartInstance) => {
                const { ctx, data, scales } = chartInstance;
                const xScale = scales.x;
                const yScale = scales.y;
                data.labels.forEach((lab, idx) => {
                    const total = data.datasets.reduce((sum, ds) => sum + (Number(ds.data[idx]) || 0), 0);
                    const x = xScale.getPixelForValue(idx);
                    const y = yScale.getPixelForValue(total);
                    if (isNaN(x) || isNaN(y)) return;
                    ctx.save();
                    ctx.font = 'bold 12px Arial';
                    ctx.fillStyle = '#333';
                    ctx.textAlign = 'center';
                    // Draw a small rounded rectangle (dashed look omitted for simplicity)
                    const text = formatTime(total);
                    ctx.fillText(text, x, y - 8);
                    ctx.restore();
                });
            }
        };

        chart = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const domain = context.dataset.label || '';
                                const value = (context.parsed && (context.parsed.y ?? context.parsed)) || context.raw || 0;
                                return `${domain}: ${formatTime(value)}`;
                            }
                        }
                    },
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12 },
                        // disable default click-to-toggle behavior so all domains remain visible
                        onClick: () => {}
                    }
                },
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, ticks: { callback: (v) => formatTime(v) } }
                },
                onClick: (evt, elements) => {
                    if (!elements || !elements.length) return;
                    const el = elements[0];
                    const domain = datasets[el.datasetIndex].label;
                    const rep = representativeUrl[domain];
                    if (rep && rep.url) chrome.tabs.create({ url: rep.url });
                }
            },
            plugins: [totalsPlugin]
        });
    }

    async function updateTable(trackingData) {
        if (!urlTableBody) {
            console.error('Could not find urlTableBody element');
            return;
        }

        urlTableBody.innerHTML = '';
        
        if (!trackingData || !trackingData.timeDictionary) {
            console.log('No tracking data available');
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 3;
            cell.textContent = 'No data available yet';
            cell.style.textAlign = 'center';
            row.appendChild(cell);
            urlTableBody.appendChild(row);
            return;
        }

        const openTabs = await chrome.tabs.query({});
        const openUrls = new Set(openTabs.map(tab => tab.url));

        const entries = Object.entries(trackingData.timeDictionary)
            .filter(([url]) => Array.from(openUrls).some(openUrl => 
                getDomain(url) === getDomain(openUrl)
            ))
            .sort((a, b) => b[1] - a[1]);

        if (entries.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 3;
            cell.textContent = 'No active tabs being tracked';
            cell.style.textAlign = 'center';
            row.appendChild(cell);
            urlTableBody.appendChild(row);
            return;
        }

        // Render chart first
        renderStackedChart(entries);

        // Then populate table
        entries.forEach(([url, timeSpent]) => {
            const row = document.createElement('tr');
            
            const urlCell = document.createElement('td');
            const domain = getDomain(url);
            urlCell.textContent = domain;
            urlCell.title = url;
            
            const timeCell = document.createElement('td');
            timeCell.textContent = formatTime(timeSpent);
            
            const classCell = document.createElement('td');
            const classification = getClassification(url);
            classCell.textContent = classification;
            classCell.classList.add(classification);
            
            row.appendChild(urlCell);
            row.appendChild(timeCell);
            row.appendChild(classCell);
            urlTableBody.appendChild(row);
        });
    }

    // Load initial data
    chrome.storage.local.get(['trackingState'], async function(result) {
        if (chrome.runtime.lastError) {
            console.error('Error accessing storage:', chrome.runtime.lastError);
            return;
        }
        await updateTable(result.trackingState);
    });

    // Listen for storage changes
    chrome.storage.onChanged.addListener(function(changes, namespace) {
        if (namespace === 'local' && changes.trackingState) {
            updateTable(changes.trackingState.newValue).catch(console.error);
        }
    });

    // Update every 5 seconds
    setInterval(() => {
        chrome.storage.local.get(['trackingState'], function(result) {
            if (result.trackingState) {
                updateTable(result.trackingState).catch(console.error);
            }
        });
    }, 5000);
});