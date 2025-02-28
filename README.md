# Eleventy StaticCrypt Plugin

A simple plugin for [11ty/Eleventy](https://www.11ty.dev/) that adds client-side password protection to static pages using AES-256-GCM encryption.

## Features

- 🔒 Client-side AES-256-GCM encryption
- 💾 No server-side components required
- 🔑 Password persistence with 5-day expiry
- 🚀 Works with any static hosting
- ⚡ Preserves and reloads page scripts after decryption

## Installation

The plugin is included in the site's source code at `src/_plugins/staticrypt.js`.

## Usage

### 1. Add to your Eleventy config

```javascript
const staticrypt = require('./src/_plugins/staticrypt.js');

module.exports = function(eleventyConfig) {
    eleventyConfig.addPlugin(staticrypt);
};
```

### 2. Protect pages

Add the `<!--PROTECT-->` comment anywhere in your HTML or template files to enable encryption:

```html
<!--PROTECT-->
<h1>Secret Content</h1>
<p>This content will be encrypted.</p>
```

## How it Works

### Build Time Encryption

1. During the Eleventy build process, the plugin:
   - Looks for pages containing the `<!--PROTECT-->` comment
   - Removes the protection comment from the content
   - Encrypts the page content using AES-256-GCM with these steps:
     ```javascript
     // Generate encryption key from password using PBKDF2
     const key = crypto.pbkdf2Sync(SITE_PASSWORD, 'salt', 100000, 32, 'sha256');
     // Generate random IV for GCM mode
     const iv = crypto.randomBytes(12);
     // Encrypt content
     const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
     ```
   - Stores the encrypted data, IV, and authentication tag in a JSON file
   - Replaces the page content with a password prompt template

### Client-Side Decryption

When a user visits a protected page:

1. They see a password form instead of the actual content
2. When they enter the password:
   ```javascript
   // Key derivation matches the build-time process
   const key = await crypto.subtle.importKey(
       'raw',
       await crypto.subtle.deriveBits(
           {
               name: 'PBKDF2',
               salt: new TextEncoder().encode('salt'),
               iterations: 100000,
               hash: 'SHA-256'
           },
           passwordKey,
           256
       ),
       'AES-GCM',
       false,
       ['decrypt']
   );
   
   // Decrypt the content
   const decrypted = await crypto.subtle.decrypt(
       {
           name: 'AES-GCM',
           iv: iv,
           tagLength: 128
       },
       key,
       encryptedData
   );
   ```
3. If decryption succeeds:
   - The decrypted HTML replaces the entire page content
   - Any scripts in the original page are reloaded
   - The password can be saved in localStorage for 5 days

### Password Persistence

The plugin implements a "Remember Me" feature:

1. When a user successfully decrypts a page and checks "Remember Me":
   ```javascript
   const expiryDate = new Date();
   expiryDate.setDate(expiryDate.getDate() + PASSWORD_EXPIRY_DAYS);
   localStorage.setItem('staticrypt_password', password);
   localStorage.setItem('staticrypt_expiry', expiryDate.toISOString());
   ```

2. On subsequent visits:
   - The stored password is automatically retrieved
   - If not expired, decryption is attempted immediately
   - If successful, the page content is decrypted without showing the prompt

### Script Handling

To ensure all JavaScript functionality works after decryption:

1. Before encryption, the plugin preserves all script tags
2. After successful decryption:
   ```javascript
   window.staticrypt_afterDecrypt = function() {
       // Reload all scripts from the original page
       const scripts = document.getElementsByTagName('script');
       Array.from(scripts).forEach(script => {
           if (script.src) {
               // External scripts
               const newScript = document.createElement('script');
               newScript.src = script.src;
               document.body.appendChild(newScript);
           } else if (!script.textContent.includes('staticrypt')) {
               // Inline scripts (excluding decryption code)
               const newScript = document.createElement('script');
               newScript.textContent = script.textContent;
               document.body.appendChild(newScript);
           }
       });
   }
   ```

## Configuration

The following constants are defined in the plugin:

```javascript
const SITE_PASSWORD = 'mihra'; // The password required to decrypt
const PASSWORD_EXPIRY_DAYS = 5; // Number of days to remember the password
```

## Security Notes

- Encryption is performed using AES-256-GCM with PBKDF2 key derivation
- The password is never transmitted to any server
- Protected content remains encrypted in your site's build output
- While the encryption is strong, the decryption key is included in the page (as required for client-side decryption)

## Credits

Built with:
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- Inspired by [StatiCrypt](https://github.com/robinmoisson/staticrypt)

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see the [LICENSE](LICENSE) file for details

## Support

- 📚 [Documentation](https://www.11ty.dev/docs/)
- 🐛 [Issue Tracker](https://github.com/yourusername/eleventy-plugin-staticrypt/issues)
- 💬 [Discussions](https://github.com/yourusername/eleventy-plugin-staticrypt/discussions) 