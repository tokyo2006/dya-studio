export type Language = "en" | "ja";

export type TranslationParams = Record<string, string | number>;

export const languageLabels: Record<Language, string> = {
  en: "English",
  ja: "日本語",
};

const ja: Record<string, string> = {
  "DYA Studio for DYA & ZMK Keyboards":
    "DYA & ZMK キーボードのための DYA Studio",
  Home: "ホーム",
  Keymap: "キーマップ",
  Trackball: "トラックボール",
  BLE: "BLE",
  Settings: "設定",
  Battery: "バッテリー",
  Subsystems: "サブシステム",
  Connected: "接続中",
  Disconnect: "切断",
  "Connect Keyboard": "キーボードを接続",
  "Connecting...": "接続中...",
  "Switch to light mode": "ライトモードに切り替え",
  "Switch to dark mode": "ダークモードに切り替え",
  Language: "言語",
  "Switch language": "言語を切り替え",
  Refresh: "更新",
  Cancel: "キャンセル",
  Continue: "続行",
  Open: "開く",
  Close: "閉じる",
  Clear: "クリア",
  Set: "設定",
  Save: "保存",
  "Saving...": "保存中...",
  Dismiss: "閉じる",
  Loading: "読み込み中",
  "Never show again": "今後表示しない",
  "Welcome to DYA Studio": "DYA Studio へようこそ",
  "DYA Studio is yet another ZMK Studio for DYA keyboard series, designed by cormoran707":
    "DYA Studio は cormoran707 が設計した DYA キーボードシリーズ向けのもう一つの ZMK Studio です",
  "Share on X": "X で共有",
  "DYA is pronounced dai-a.": "DYA の読み方はダイアです",
  "cormoran is pronounced cormoran [kˈɔɚm(ə)rən].":
    "cormoran の読み方はコーモラン [kˈɔɚm(ə)rən] です",
  "Features - What you can do with DYA Studio":
    "機能 - DYA Studio でできること",
  "You can customize keymaps with a slightly easier UI, equivalent to ZMK Studio.":
    "少し使いやすい UI で ZMK Studio と同等のキーマッピングカスタマイズができます。",
  "You can configure trackball sensitivity, auto layer switching and various input processor settings.":
    "トラックボールの感度、自動レイヤー切り替え、各種入力プロセッサー設定を変更できます。",
  "You can check battery consumption history stored on the device.":
    "デバイスに保存されたバッテリー消費履歴を確認できます。",
  "You can name BLE connection targets and unpair them.":
    "BLE 接続先に名前を付けたり、ペアリングを解除したりできます。",
  "You can change various settings such as the time to enter sleep mode.":
    "スリープに入る時間など、各種設定を変更できます。",
  "See also below Q&A section for more details.":
    "詳細は下の Q&A セクションも参照してください。",
  "DYA Keyboard series": "DYA キーボードシリーズ",
  "40% Split keyboard for mobile use.":
    "モバイル用途向けの 40% 分割キーボード。",
  Design: "設計",
  Buy: "購入",
  Docs: "ドキュメント",
  "Next generation DYA keyboard, 60% split, standard row-staggered layout.":
    "次世代 DYA キーボード。60% 分割、標準的なロウスタッガード配列。",
  "Coming Soon": "近日公開",
  "Watch Booth": "Booth を見る",
  "Q: Can my keyboard support DYA Studio?":
    "Q: 自分のキーボードは DYA Studio に対応できますか？",
  "A: Yes, you can use the keymap feature without any modification with your ZMK keyboard.":
    "A: はい。ZMK キーボードであれば、変更なしでキーマップ機能を使えます。",
  "You can also support other features by using cormoran's ZMK fork and cormoran's ZMK modules, although it's not suggested considering compatibility and maintainability.":
    "cormoran の ZMK fork と ZMK モジュールを使うことで他の機能にも対応できますが、互換性と保守性を考えると推奨しません。",
  "Please refer to the experimental zmk-config for DYA Dash keyboard.":
    "DYA Dash キーボード向けの experimental zmk-config を参照してください。",
  "Warning: cormoran's ZMK fork is very experimental, optimized for DYA keyboards and may contain unstable or breaking changes. Use at your own risk. In rare cases, it may cause malfunction or damage to your keyboard hardware.":
    "警告: cormoran の ZMK fork は非常に実験的で、DYA キーボード向けに最適化されています。不安定な変更や破壊的変更を含む可能性があります。自己責任で使用してください。まれにキーボードハードウェアの誤動作や損傷につながる場合があります。",
  "Q: Can I get source code of DYA Studio?":
    "Q: DYA Studio のソースコードを入手できますか？",
  "A: No, for now. DYA Studio is currently closed source to avoid people relying on my heavily customized zmk-fork. If you have feedback or feature request, please complaint on X with #dya_studio hashtag.":
    "A: 現時点ではできません。DYA Studio は、強くカスタマイズされた zmk-fork への依存を避けるため、現在クローズドソースです。フィードバックや機能要望がある場合は、X で #dya_studio ハッシュタグを付けて投稿してください。",
  "Q: Are there plan to migrate the ZMK fork to ZMK v0.4.0?":
    "Q: ZMK fork を ZMK v0.4.0 へ移行する予定はありますか？",
  "A: Yes, I'm willing but not soon...":
    "A: はい、やる気はありますが、すぐではありません...",

  "Configure key bindings and layers": "キー割り当てとレイヤーを設定します",
  "● Unsaved changes": "● 未保存の変更",
  Stream: "ストリーム",
  "Toggle stream mode": "ストリームモードを切り替え",
  "Reset All": "すべてリセット",
  "Connect your keyboard to edit keymaps":
    "キーマップを編集するにはキーボードを接続してください",
  "Loading keymap data...": "キーマップデータを読み込み中...",
  "Are you sure you want to discard all changes?":
    "すべての変更を破棄しますか？",
  "Are you sure you want to delete this layer?": "このレイヤーを削除しますか？",
  "Layer {{id}}": "レイヤー {{id}}",
  Sort: "並び替え",
  "Move layer up (higher priority)": "レイヤーを上へ移動（優先度を上げる）",
  "Move layer down (lower priority)": "レイヤーを下へ移動（優先度を下げる）",
  "Add new layer": "新しいレイヤーを追加",
  "Delete current layer": "現在のレイヤーを削除",
  "Restore deleted layer": "削除したレイヤーを復元",
  "Restore deleted layer ({{count}} available)":
    "削除したレイヤーを復元（{{count}} 件利用可能）",
  "No deleted layers to restore": "復元できる削除済みレイヤーはありません",
  "Physical Layout": "物理レイアウト",
  "Layout {{id}}": "レイアウト {{id}}",
  "OS Layout": "OS 配列",
  "Choose OS's keyboard layout setting": "OS のキーボード配列設定を選択",
  "This setting only affects the visual key labels in DYA Studio web UI.":
    "この設定は DYA Studio Web UI 上のキー表示にのみ影響します。",
  "Changing this does not update any firmware setting. The keyboard is detected as US regardless of this setting. Please change the layout setting in your OS if needed. For MacOS, USB connection is always detected as US and cannot be changed for now.":
    "これを変更してもファームウェア設定は更新されません。この設定に関係なく、キーボードは US として検出されます。必要に応じて OS 側の配列設定を変更してください。macOS では USB 接続が常に US として検出され、現時点では変更できません。",
  "The selection is saved in your browser's local storage for now.":
    "この選択は現在ブラウザーのローカルストレージに保存されます。",
  "Physical layout module preview could not be loaded: {{error}}":
    "物理レイアウトモジュールのプレビューを読み込めませんでした: {{error}}",
  "Runtime sensor rotation subsystem is not available for your keyboard. Rotary encoder configuration will not be displayed. You can enable the feature by applying cormoran/zmk-behavior-runtime-sensor-rotate in your firmware.":
    "このキーボードではランタイムセンサー回転サブシステムを利用できません。ロータリーエンコーダー設定は表示されません。ファームウェアに cormoran/zmk-behavior-runtime-sensor-rotate を適用すると、この機能を有効にできます。",
  "Click on a key to modify its binding. Modified keys are highlighted in green and show the original binding on hover. Use the Reset All button to discard all changes.":
    "キーをクリックして割り当てを変更します。変更されたキーは緑で強調表示され、ホバーすると元の割り当てが表示されます。すべての変更を破棄するには「すべてリセット」を使ってください。",
  "Connect your keyboard to edit keymaps. Click on a key to modify its binding.":
    "キーマップを編集するにはキーボードを接続してください。キーをクリックすると割り当てを変更できます。",

  "Trackball Settings": "トラックボール設定",
  "Adjust sensitivity and behavior via runtime input processor":
    "ランタイム入力プロセッサーで感度と動作を調整します",
  "Runtime input processor subsystem is not available for your keyboard.":
    "このキーボードではランタイム入力プロセッサーサブシステムを利用できません。",
  "Make sure your firmware has the {{module}} enabled.":
    "ファームウェアで {{module}} が有効になっていることを確認してください。",
  "Loading trackball settings...": "トラックボール設定を読み込み中...",
  "No runtime input processor found. Make sure your firmware has the runtime input processor module enabled.":
    "ランタイム入力プロセッサーが見つかりません。ファームウェアでランタイム入力プロセッサーモジュールが有効になっていることを確認してください。",
  "Select Processor": "プロセッサーを選択",
  "{{count}} processors detected": "{{count}} 個のプロセッサーを検出",
  "Active on Layers": "有効にするレイヤー",
  "Configure which layers this processor is active on":
    "このプロセッサーを有効にするレイヤーを設定します",
  "Processor is active on all layers":
    "プロセッサーはすべてのレイヤーで有効です",
  "Loading layers...": "レイヤーを読み込み中...",
  Scaling: "スケーリング",
  "Adjust sensitivity from 0.1x to 10x":
    "感度を 0.1x から 10x の範囲で調整します",
  "Decrease scaling": "スケーリングを下げる",
  "Increase scaling": "スケーリングを上げる",
  "Sensor Rotation": "センサー回転",
  "Rotate input for different mounting angles":
    "取り付け角度に合わせて入力を回転します",
  "Decrease rotation": "回転角度を下げる",
  "Increase rotation": "回転角度を上げる",
  "Axis Snapping": "軸スナップ",
  "Constrain movement to a single axis for precision scrolling":
    "精密なスクロールのため、移動を単一の軸に制限します",
  "Snap Axis": "スナップ軸",
  "Y Axis (Vertical)": "Y 軸（垂直）",
  "X Axis (Horizontal)": "X 軸（水平）",
  "Snap Threshold": "スナップしきい値",
  "Threshold for unsnapping from the locked axis":
    "ロックされた軸からスナップ解除するしきい値",
  "Snap Timeout": "スナップタイムアウト",
  "Time window for threshold check": "しきい値チェックの時間幅",
  "Axis Inversion": "軸反転",
  "Reverse the direction of X or Y axis movement":
    "X 軸または Y 軸の移動方向を反転します",
  "Invert X Axis": "X 軸を反転",
  "Reverse horizontal movement direction": "水平方向の移動を反転します",
  "Invert Y Axis": "Y 軸を反転",
  "Reverse vertical movement direction": "垂直方向の移動を反転します",
  "Code Mapping": "コードマッピング",
  "Transform trackball movement into different input types":
    "トラックボールの移動を別の入力タイプに変換します",
  "XY-to-Scroll": "XY をスクロールに変換",
  "Map X/Y movement to horizontal/vertical scroll":
    "X/Y 移動を水平/垂直スクロールに割り当てます",
  "XY-Swap": "XY 入れ替え",
  "Swap X and Y axes": "X 軸と Y 軸を入れ替えます",
  "Temporary Layer": "一時レイヤー",
  "Auto-activate layer when trackball is in use":
    "トラックボール使用時にレイヤーを自動で有効化します",
  "Target Layer": "対象レイヤー",
  "Activation Delay": "有効化遅延",
  "Delay before activating layer when trackball moves":
    "トラックボール移動時にレイヤーを有効化するまでの遅延",
  "Deactivation Delay": "無効化遅延",
  "Delay before deactivating layer when trackball stops":
    "トラックボール停止時にレイヤーを無効化するまでの遅延",

  "BLE Connections": "BLE 接続",
  "Manage Bluetooth upstream connections":
    "Bluetooth アップストリーム接続を管理します",
  "Refresh profiles": "プロファイルを更新",
  "BLE management subsystem is not available for your keyboard.":
    "このキーボードでは BLE 管理サブシステムを利用できません。",
  "Output Priority": "出力優先度",
  "Prioritized connection for keystrokes": "キー入力を優先して送信する接続先",
  "Loading profiles...": "プロファイルを読み込み中...",
  "Device name": "デバイス名",
  "Save name": "名前を保存",
  "Cancel editing": "編集をキャンセル",
  "Edit name": "名前を編集",
  "Profile {{index}}": "プロファイル {{index}}",
  "Not paired": "ペアリングなし",
  "No address": "アドレスなし",
  Unpair: "ペアリング解除",
  Switch: "切り替え",
  Active: "アクティブ",
  "Are you sure you want to unpair this device?":
    "このデバイスのペアリングを解除しますか？",
  "Change Output Priority?": "出力優先度を変更しますか？",
  "Changing the output priority may disconnect DYA Studio from your keyboard.":
    "出力優先度を変更すると、DYA Studio とキーボードの接続が切断される場合があります。",
  "You will need to reconnect manually after the change.":
    "変更後は手動で再接続する必要があります。",

  "Battery Status": "バッテリー状態",
  "Monitor battery levels and history": "バッテリー残量と履歴を確認します",
  "Refresh battery history": "バッテリー履歴を更新",
  "Clear battery history": "バッテリー履歴を消去",
  "Clear History": "履歴を消去",
  "Battery history feature is not stable for now. Please consider zmk-battery-center application instead.":
    "バッテリー履歴機能は現在安定していません。代わりに zmk-battery-center アプリケーションの利用を検討してください。",
  "If you use battery history feature, be careful about recording interval, if history is recorded too frequently, flush drive might reach to its hardware limit soon.":
    "バッテリー履歴機能を使用する場合は記録間隔に注意してください。頻繁に記録しすぎると、フラッシュドライブが早期にハードウェア上の限界に達する可能性があります。",
  "Battery history subsystem is not available for your keyboard.":
    "このキーボードではバッテリー履歴サブシステムを利用できません。",
  Central: "中央側",
  Peripheral: "周辺側",
  "Last Updated": "最終更新",
  "Battery History": "バッテリー履歴",
  "Loading battery history...": "バッテリー履歴を読み込み中...",
  "No battery history available. Connect keyboard to view battery history.":
    "バッテリー履歴はありません。キーボードに接続すると履歴を表示できます。",
  "Battery history is recorded on the keyboard and shows data from all connected devices. The timestamp resets when the keyboard restarts, indicated by dashed vertical lines in the chart.":
    "バッテリー履歴はキーボード上に記録され、接続されたすべてのデバイスのデータを表示します。キーボードが再起動するとタイムスタンプはリセットされ、グラフ上では破線の縦線で示されます。",
  "Clear Battery History?": "バッテリー履歴を消去しますか？",
  "This will permanently delete all battery history data from your keyboard.":
    "キーボード上のすべてのバッテリー履歴データが完全に削除されます。",
  "This action cannot be undone.": "この操作は元に戻せません。",
  "No battery history available": "バッテリー履歴はありません",
  "Battery Level Over Time": "バッテリー残量の推移",
  "{{count}} data points": "{{count}} 件のデータポイント",
  "Battery %": "バッテリー %",
  "Dashed lines with ⟲ indicate keyboard restarts":
    "⟲ 付きの破線はキーボードの再起動を示します",

  "Device configuration and power management": "デバイス設定と電源管理",
  "Settings RPC subsystem is not available for your keyboard.":
    "このキーボードでは Settings RPC サブシステムを利用できません。",
  "Loading settings...": "設定を読み込み中...",
  "Power Management": "電源管理",
  "Idle Timeout": "アイドルタイムアウト",
  "Time before keyboard enters idle mode":
    "キーボードがアイドルモードに入るまでの時間",
  "Sleep Timeout": "スリープタイムアウト",
  "Time before entering deep sleep": "ディープスリープに入るまでの時間",
  "Apply to All Devices": "すべてのデバイスに適用",
  "Current Settings by Device": "デバイス別の現在の設定",
  "Idle: {{idle}}, Sleep: {{sleep}}": "アイドル: {{idle}}, スリープ: {{sleep}}",
  "Waiting for device connection...": "デバイス接続を待機中...",
  Never: "なし",
  "30 seconds": "30 秒",
  "1 minute": "1 分",
  "5 minutes": "5 分",
  "10 minutes": "10 分",
  "15 minutes": "15 分",
  "30 minutes": "30 分",
  "1 hour": "1 時間",
  "2 hours": "2 時間",
  "4 hours": "4 時間",
  "{{value}} min": "{{value}} 分",
  "Custom value...": "カスタム値...",
  min: "分",
  "{{count}} seconds": "{{count}} 秒",
  "{{count}} minute": "{{count}} 分",
  "{{count}} minutes": "{{count}} 分",
  "{{count}} hour": "{{count}} 時間",
  "{{count}} hours": "{{count}} 時間",
  "{{count}}s": "{{count}}秒",
  "{{count}}m": "{{count}}分",
  "{{count}}h": "{{count}}時間",

  "Custom Subsystems": "カスタムサブシステム",
  "Available custom firmware subsystems and their web interfaces":
    "利用可能なカスタムファームウェアサブシステムと Web インターフェース",
  "Close dialog": "ダイアログを閉じる",
  "External Link Warning": "外部リンクの警告",
  "You are about to open an external website provided by the keyboard firmware author:":
    "キーボードファームウェア作者が提供する外部 Web サイトを開こうとしています:",
  "Security Notice": "セキュリティ上の注意",
  "Please do not connect to an unreliable author's web page. Only proceed if you trust the keyboard firmware author. External pages may request sensitive permissions or send data to third-party servers.":
    "信頼できない作者の Web ページには接続しないでください。キーボードファームウェア作者を信頼できる場合のみ続行してください。外部ページは機密性の高い権限を要求したり、第三者のサーバーへデータを送信したりする可能性があります。",
  "Trust this URL and don't warn me again": "この URL を信頼し、今後警告しない",
  "Subsystem index: {{index}}": "サブシステムインデックス: {{index}}",
  "Web UI": "Web UI",
  "No web UI available for this subsystem.":
    "このサブシステムで利用可能な Web UI はありません。",
  "No custom subsystems available. Custom subsystems are provided by the keyboard firmware.":
    "利用可能なカスタムサブシステムはありません。カスタムサブシステムはキーボードファームウェアによって提供されます。",
  "Custom subsystems are additional features provided by your keyboard firmware author. Web UI links open external pages supplied by the firmware metadata.":
    "カスタムサブシステムは、キーボードファームウェア作者が提供する追加機能です。Web UI リンクは、ファームウェアメタデータで提供された外部ページを開きます。",

  Connect: "接続",
  "Connect via USB": "USB で接続",
  "Connect via Bluetooth": "Bluetooth で接続",
  "Try Demo Mode": "デモモードを試す",
  "Try Demo Mode (no device required)": "デモモードを試す（デバイス不要）",
  "Try demo mode without a keyboard": "キーボードなしでデモモードを試せます",
  "DYA Studio is maintained by": "DYA Studio のメンテナー",
  "Special thanks to": "Special thanks to",
  "ZMK community": "ZMK community",
  "Connect via {{method}}": "{{method}} で接続",
  "Data Collection Notice": "データ収集に関するお知らせ",
  "DYA Studio collects your keyboard name for usage analysis purposes. However, no other keyboard data is sent to any servers. All of your keyboard configurations, keymaps, or settings are handled locally.":
    "DYA Studio は利用状況分析のためにキーボード名を収集します。ただし、それ以外のキーボードデータはサーバーへ送信されません。キーボード設定、キーマップ、各種設定はすべてローカルで処理されます。",
  "BLE Not Supported on your Browser":
    "このブラウザーは BLE に対応していません",
  "Your browser does not support Web Bluetooth API. Please use a compatible browser like Chrome, Edge, or Bluefy (iOS). BLE device discovery on non-Linux system requires cormoran's ZMK fork + press the studio unlock key on your keyboard.":
    "このブラウザーは Web Bluetooth API に対応していません。Chrome、Edge、Bluefy (iOS) などの対応ブラウザーを使用してください。非 Linux 環境での BLE デバイス検出には、cormoran の ZMK fork とキーボード上の studio unlock キー操作が必要です。",
  "Serial Not Supported on your Browser":
    "このブラウザーはシリアル接続に対応していません",
  "Your browser does not support Web Serial API. Please use a compatible browser. Note that web serial is not available on mobile devices.":
    "このブラウザーは Web Serial API に対応していません。対応ブラウザーを使用してください。Web Serial はモバイルデバイスでは利用できません。",
  "How to Discover your Keyboard via BLE": "BLE でキーボードを検出する方法",
  "Press the studio unlock key on your keyboard for non-linux systems.":
    "非 Linux 環境では、キーボードの studio unlock キーを押してください。",
  "cormoran's ZMK fork is also required for BLE device discovery on non-Linux systems.":
    "非 Linux 環境で BLE デバイスを検出するには cormoran の ZMK fork も必要です。",
  "Agree to start": "同意して開始",
  "compatible browser": "対応ブラウザー",
  "Keyboard Unlock Required": "キーボードのロック解除が必要です",
  "Your keyboard's ZMK Studio is locked. Please unlock it to continue editing your keymap.":
    "キーボードの ZMK Studio がロックされています。キーマップ編集を続けるにはロックを解除してください。",
  "How to Unlock": "ロック解除方法",
  "Press the studio unlock key combination on your keyboard":
    "キーボードで studio unlock キーコンビネーションを押します",
  "Look for a notification or LED indication that confirms unlock":
    "ロック解除を示す通知または LED 表示を確認します",
  "Click Retry below to continue": "下の「再試行」をクリックして続行します",
  "The unlock key combination is typically configured in your ZMK keymap. Check your firmware configuration if you're unsure.":
    "ロック解除キーコンビネーションは通常 ZMK キーマップで設定されています。不明な場合はファームウェア設定を確認してください。",
  Retry: "再試行",

  "Select Key Binding": "キー割り当てを選択",
  "Close on select": "選択時に閉じる",
  Revert: "元に戻す",
  Behavior: "ビヘイビア",
  "Behaviors not loaded from keyboard.":
    "キーボードからビヘイビアを読み込めませんでした。",
  Parameters: "パラメーター",
  param1: "param1",
  param2: "param2",
  "Mouse Button": "マウスボタン",
  "Pointer movement": "ポインター移動",
  Constant: "定数",
  Range: "範囲",
  Keycode: "キーコード",
  Layer: "レイヤー",
  "Unknown Type": "不明な型",
  "Select {{name}}": "{{name}} を選択",
  "Select options": "オプションを選択",
  "Select behavior": "ビヘイビアを選択",
  "Quick Select": "クイック選択",
  "Recently used": "最近使用",
  All: "すべて",
  "Key Press": "キー入力",
  Layers: "レイヤー",
  Modifiers: "修飾キー",
  Mouse: "マウス",
  Transport: "通信",
  System: "システム",
  Misc: "その他",
  Others: "その他",
  "Press a key": "キーを押す",
  "Activate layer while held": "押している間レイヤーを有効化",
  "Switch to layer": "レイヤーへ切り替え",
  "Toggle layer on/off": "レイヤーのオン/オフを切り替え",
  "Layer on hold, key on tap": "長押しでレイヤー、タップでキー",
  "Transparent (pass-through to lower layer)": "透過（下位レイヤーへパス）",
  "No operation": "何もしない",
  "Modifier on hold, key on tap": "長押しで修飾キー、タップでキー",
  "Execute macro": "マクロを実行",
  "Toggle key on/off with each press": "押すたびにキーのオン/オフを切り替え",
  "A sticky key stays pressed until another key is pressed.":
    "別のキーが押されるまで押下状態を維持します。",
  "A sticky layer stays pressed until another key is pressed":
    "別のキーが押されるまでレイヤーを維持します",
  "Caps lock, but automatically deactivates": "自動解除される Caps Lock",
  "Repeat last-pressed key while held":
    "押している間、最後に押したキーを繰り返す",
  "Mouse key press": "マウスボタン入力",
  "Move mouse cursor.": "マウスカーソルを移動します。",
  "Scroll mouse wheel.": "マウスホイールをスクロールします。",
  "Enter bootloader mode": "ブートローダーモードに入る",
  "System reset": "システムリセット",
  "Bluetooth profile management": "Bluetooth プロファイル管理",
  "Output selection (USB/BLE)": "出力先選択（USB/BLE）",
  "Unlock keyboard for ZMK Studio and DYA Studio":
    "ZMK Studio と DYA Studio のためにキーボードをロック解除",
  "Grave(`) on shift or GUI, otherwise Escape":
    "Shift または GUI では Grave(`)、それ以外では Escape",
  "Search keycodes...": "キーコードを検索...",
  "Clear search": "検索をクリア",
  "No keycodes found": "キーコードが見つかりません",
  Letters: "文字",
  Numbers: "数字",
  Navigation: "ナビゲーション",
  "Function Keys": "ファンクションキー",
  Numpad: "テンキー",
  Media: "メディア",
  Punctuation: "記号",
  International: "国際",
  Miscellaneous: "その他",
  "Select value ({{min}} to {{max}})": "値を選択（{{min}} から {{max}}）",
  "Range: {{min}} to {{max}}": "範囲: {{min}} から {{max}}",
  "Min ({{min}})": "最小（{{min}}）",
  "Max ({{max}})": "最大（{{max}}）",
  "Quick Presets (default: ±{{defaultValue}})":
    "クイックプリセット（デフォルト: ±{{defaultValue}}）",
  "Custom Values (range: -32768 to 32767)":
    "カスタム値（範囲: -32768 から 32767）",
  "X-axis (Horizontal)": "X 軸（水平）",
  "Y-axis (Vertical)": "Y 軸（垂直）",
  "- = Left, + = Right": "- = 左, + = 右",
  "- = Down, + = Up": "- = 下, + = 上",
  "- = Up, + = Down": "- = 上, + = 下",
  "Current: X={{x}}, Y={{y}} (encoded: 0x{{encoded}})":
    "現在値: X={{x}}, Y={{y}}（エンコード: 0x{{encoded}}）",
  "Move Up": "上へ移動",
  "Move Down": "下へ移動",
  "Move Left": "左へ移動",
  "Move Right": "右へ移動",
  "Scroll Up": "上へスクロール",
  "Scroll Down": "下へスクロール",
  "Scroll Left": "左へスクロール",
  "Scroll Right": "右へスクロール",
  "Left Click": "左クリック",
  "Right Click": "右クリック",
  "Middle Click": "中央クリック",
  "Button 4": "ボタン 4",
  "Button 5": "ボタン 5",
  "Rotary Encoder Configuration": "ロータリーエンコーダー設定",
  "The value is saved in real-time upon selection for now.":
    "現在、値は選択時にリアルタイムで保存されます。",
  "Rotary Encoder": "ロータリーエンコーダー",
  "Counter-clockwise": "反時計回り",
  Clockwise: "時計回り",
  "Tap Time": "タップ時間",
  "Time between rotation triggers": "回転トリガー間の時間",
  "pending to save...": "保存待ち...",
  "For scroll or mouse move, tap time need to be > behavior-input-two-axis's trigger-period-ms (default 16ms).":
    "スクロールまたはマウス移動では、タップ時間を behavior-input-two-axis の trigger-period-ms（デフォルト 16ms）より大きくする必要があります。",
  "Loading sensors...": "センサーを読み込み中...",
  "No rotary encoders detected": "ロータリーエンコーダーが検出されません",
  Trans: "透過",
  "Behavior {{id}}": "ビヘイビア {{id}}",
  "Reset to original": "元に戻す",
  Binding: "割り当て",
  Original: "元の割り当て",
  disabled: "無効",
  Type: "種類",
  Links: "リンク",
  "Health Check": "ヘルスチェック",
  "Circuit and component diagnostics": "回路とコンポーネントの診断",
  "Left MCU": "左 MCU",
  "Right MCU": "右 MCU",
  "Trackball IC": "トラックボール IC",
  "Left Battery": "左バッテリー",
  "Right Battery": "右バッテリー",
  "BLE Radio": "BLE 無線",
  "Main controller communication": "メインコントローラー通信",
  "Split keyboard communication": "分割キーボード通信",
  "PMW3360 sensor connection": "PMW3360 センサー接続",
  "Battery fuel gauge": "バッテリー残量ゲージ",
  "Bluetooth module status": "Bluetooth モジュール状態",
  ok: "正常",
  error: "エラー",
  unknown: "不明",
  "Run Diagnostics": "診断を実行",
  "Connect your keyboard to run hardware diagnostics. This will check communication with all components and report any issues.":
    "ハードウェア診断を実行するにはキーボードを接続してください。すべてのコンポーネントとの通信を確認し、問題があれば報告します。",
};

const dictionaries: Record<Language, Record<string, string>> = {
  en: {},
  ja,
};

export function translate(
  language: Language,
  key: string,
  params?: TranslationParams,
): string {
  const template = dictionaries[language][key] ?? key;
  if (!params) {
    return template;
  }
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
    template,
  );
}
