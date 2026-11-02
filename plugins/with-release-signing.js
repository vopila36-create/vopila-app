/**
 * Android release derlemesini VOPILA'nın kendi yükleme anahtarıyla imzalar.
 * Anahtar ve şifreler depoda DEĞİL; kullanıcının ~/.gradle/gradle.properties dosyasında:
 *   VOPILA_UPLOAD_STORE_FILE, VOPILA_UPLOAD_KEY_ALIAS, VOPILA_UPLOAD_STORE_PASSWORD, VOPILA_UPLOAD_KEY_PASSWORD
 * Bu değerler yoksa (başka bir bilgisayar) eskisi gibi test anahtarıyla imzalanır.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = '// vopila-release-signing';

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes(MARK)) return cfg;

    src = src.replace(
      /signingConfigs\s*\{\s*\n(\s*)debug\s*\{/,
      (m, indent) =>
        `signingConfigs {\n${indent}${MARK}\n${indent}release {\n` +
        `${indent}    if (project.hasProperty('VOPILA_UPLOAD_STORE_FILE')) {\n` +
        `${indent}        storeFile file(VOPILA_UPLOAD_STORE_FILE)\n` +
        `${indent}        storePassword VOPILA_UPLOAD_STORE_PASSWORD\n` +
        `${indent}        keyAlias VOPILA_UPLOAD_KEY_ALIAS\n` +
        `${indent}        keyPassword VOPILA_UPLOAD_KEY_PASSWORD\n` +
        `${indent}    }\n${indent}}\n${indent}debug {`,
    );
    src = src.replace(
      /(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/,
      (m, head) =>
        `${head}signingConfig project.hasProperty('VOPILA_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`,
    );
    cfg.modResults.contents = src;
    return cfg;
  });
};
