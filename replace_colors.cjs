const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, callback);
    else callback(p);
  });
}

const replacements = [
  // Class replacements for specific hex colors
  { from: /bg-\[#0662BB\]/g, to: 'bg-swiftly-deep' },
  { from: /text-\[#0662BB\]/g, to: 'text-swiftly-deep' },
  { from: /border-\[#0662BB\]/g, to: 'border-swiftly-deep' },
  { from: /ring-\[#0662BB\]/g, to: 'ring-swiftly-deep' },
  
  { from: /bg-\[#10B981\]/g, to: 'bg-swiftly-orange' },
  { from: /text-\[#10B981\]/g, to: 'text-swiftly-orange' },
  { from: /border-\[#10B981\]/g, to: 'border-swiftly-orange' },
  { from: /ring-\[#10B981\]/g, to: 'ring-swiftly-orange' },
  { from: /#10B981/g, to: 'var(--swiftly-orange)' },

  { from: /bg-\[#F5F5F0\]/g, to: 'bg-swiftly-cream' },
  { from: /text-\[#F5F5F0\]/g, to: 'text-swiftly-cream' },
  { from: /border-\[#F5F5F0\]/g, to: 'border-swiftly-cream' },
  
  { from: /bg-\[#EBF5FF\]/g, to: 'bg-swiftly-mint' },
  { from: /bg-\[#E6F4F1\]/g, to: 'bg-swiftly-mint' },

  { from: /hover:bg-yellow-500/g, to: 'hover:bg-swiftly-amber' },
  { from: /bg-yellow-500/g, to: 'bg-swiftly-amber' },
  
  // General fallback for hardcoded colors in style objects
  { from: /#0662BB/g, to: 'var(--swiftly-deep)' },
  { from: /#F5F5F0/g, to: 'var(--swiftly-cream)' },
];

walk(srcDir, (p) => {
  if (p.endsWith('.tsx') || p.endsWith('.ts')) {
    let content = fs.readFileSync(p, 'utf8');
    let original = content;
    replacements.forEach(r => {
      content = content.replace(r.from, r.to);
    });
    if (content !== original) {
      fs.writeFileSync(p, content, 'utf8');
      console.log('Updated', p);
    }
  }
});
