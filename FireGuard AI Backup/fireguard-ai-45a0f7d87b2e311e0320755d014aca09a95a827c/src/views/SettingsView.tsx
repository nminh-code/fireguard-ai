import React, { useState, useEffect } from 'react';
import { SystemSettings, User } from '../types';
import { siteService } from '../services/siteService';
import { authService } from '../services/authService';
import { soundManager } from '../utils/audioAlert';
import {
  Settings,
  Bell,
  Sliders,
  UserCheck,
  Volume2,
  ShieldAlert,
  Phone,
  Save,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [user, setUser] = useState<User>(authService.getCurrentUser());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'system'>('notifications');

  useEffect(() => {
    siteService.getSettings().then(setSettings);
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    await siteService.updateSettings(settings);
    soundManager.setEnabled(settings.soundAlert);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleTestSound = () => {
    soundManager.playFireAlarm();
  };

  if (!settings) return null;

  return (
    <div className="space-y-6 max-w-4xl" id="settings-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">
            Cài Đặt Hệ Thống & Cảnh Báo
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tùy biến ngưỡng AI, kênh gửi thông báo khẩn cấp và thông tin người phụ trách
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-xs font-bold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Save className="h-4 w-4" />
          <span>Lưu Thay Đổi</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800 animate-in fade-in-50">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>Đã lưu thành công các thiết lập hệ thống Favis AI!</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'notifications'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Bell className="h-3.5 w-3.5" />
          <span>Thông Báo Khẩn Cấp</span>
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'system'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>Cấu Hình AI & Hệ Thống</span>
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'profile'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <UserCheck className="h-3.5 w-3.5" />
          <span>Hồ Sơ Cán Bộ Trực</span>
        </button>
      </div>

      {/* Tab 1: Notifications Settings */}
      {activeTab === 'notifications' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Kênh Thông Báo Cảnh Báo Cháy (Notification Channels)
            </h3>

            {/* Push notification */}
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div>
                <div className="text-xs font-bold text-slate-900">Push Notifications (Trình duyệt & Ứng dụng)</div>
                <div className="text-xs text-slate-500">
                  Hiển thị thông báo nổi ngay lập tức khi phát hiện event FIRE_CONFIRMED
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.pushNotifications}
                  onChange={(e) =>
                    setSettings({ ...settings, pushNotifications: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>

            {/* Critical Alert */}
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Critical Alert (Ghi đè chế độ im lặng)</span>
                  <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">
                    KHUYẾN NGHỊ
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  Phát cảnh báo mức ưu tiên cao nhất, bypass chế độ không làm phiền của thiết bị an ninh
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.criticalAlertOverride}
                  onChange={(e) =>
                    setSettings({ ...settings, criticalAlertOverride: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>

            {/* Sound Alert with Test Button */}
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div>
                <div className="text-xs font-bold text-slate-900">Âm Thanh Báo Động (Sound Alert)</div>
                <div className="text-xs text-slate-500">
                  Phát âm thanh còi hú tần số cao mô phỏng chuông báo cháy phòng điều khiển
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleTestSound}
                  type="button"
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md cursor-pointer transition-colors"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  <span>Test còi</span>
                </button>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.soundAlert}
                    onChange={(e) => setSettings({ ...settings, soundAlert: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>
            </div>

            {/* Email Notification */}
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div>
                <div className="text-xs font-bold text-slate-900">Email Notification (Báo cáo qua email)</div>
                <div className="text-xs text-slate-500">
                  Tự động gửi snapshot hiện trường và báo cáo AI tới email Ban Giám Đốc và An Ninh
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) =>
                    setSettings({ ...settings, emailNotifications: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>

            {/* SMS Emergency */}
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-xs font-bold text-slate-900">SMS Khẩn Cấp (Emergency Dispatch SMS)</div>
                <div className="text-xs text-slate-500">
                  Gửi tin nhắn SMS khẩn cấp tới danh bạ hotline PCCC cơ sở
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emergencySms}
                  onChange={(e) => setSettings({ ...settings, emergencySms: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: System Settings */}
      {activeTab === 'system' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Cấu Hình Thuật Toán Nhận Diện AI
            </h3>

            {/* Fire Detection Threshold */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-900">
                  Ngưỡng Tin Cậy Nhận Diện Lửa (Fire Confidence Threshold)
                </span>
                <span className="font-mono font-bold text-red-600">{settings.detectionThreshold}%</span>
              </div>
              <input
                type="range"
                min={60}
                max={99}
                value={settings.detectionThreshold}
                onChange={(e) =>
                  setSettings({ ...settings, detectionThreshold: Number(e.target.value) })
                }
                className="w-full accent-red-600 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Nhạy cảm cao (60%)</span>
                <span>Khuyến nghị (85%)</span>
                <span>Khắt khe (99%)</span>
              </div>
            </div>

            {/* Smoke Threshold */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-900">
                  Ngưỡng Tin Cậy Nhận Diện Khói (Smoke Confidence Threshold)
                </span>
                <span className="font-mono font-bold text-amber-600">{settings.smokeThreshold}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={95}
                value={settings.smokeThreshold}
                onChange={(e) =>
                  setSettings({ ...settings, smokeThreshold: Number(e.target.value) })
                }
                className="w-full accent-amber-600 cursor-pointer"
              />
            </div>

            {/* Verification Window */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-900">
                  Cửa Sổ Xác Thực Liên Tục (Verification Window)
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {settings.verificationWindowSeconds} giây
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={settings.verificationWindowSeconds}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    verificationWindowSeconds: Number(e.target.value),
                  })
                }
                className="w-full accent-slate-800 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500">
                AI sẽ chỉ phát sự kiện FIRE_CONFIRMED nếu ngọn lửa hoặc khói duy trì liên tục trong số
                giây đã định, giúp loại bỏ 100% hiện tượng phản quang chớp nhoáng.
              </p>
            </div>
          </div>

          {/* Emergency contacts */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Danh Bạ Ứng Cứu Khẩn Cấp Hải Phòng
            </h4>
            <div className="space-y-2">
              {settings.emergencyContacts.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900">{c.name}</div>
                    <div className="text-slate-500 text-[11px]">{c.role}</div>
                  </div>
                  <div className="font-mono font-bold text-red-600">{c.phone}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Profile */}
      {activeTab === 'profile' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
          <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="h-16 w-16 rounded-full object-cover border-2 border-slate-200"
              referrerPolicy="no-referrer"
            />
            <div>
              <h3 className="text-base font-bold text-slate-900">{user.name}</h3>
              <p className="text-xs text-slate-500">{user.email}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded uppercase">
                  Role: {user.role}
                </span>
                <span className="text-xs text-emerald-600 font-medium">● {user.status}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Họ và tên:</label>
              <input
                type="text"
                value={user.name}
                readOnly
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 font-medium cursor-not-allowed"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Email công tác:</label>
              <input
                type="text"
                value={user.email}
                readOnly
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 font-medium cursor-not-allowed"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Số điện thoại khẩn:</label>
              <input
                type="text"
                value={user.phone || '0912 345 678'}
                readOnly
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 font-medium cursor-not-allowed"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Cơ sở làm việc:</label>
              <input
                type="text"
                value="Nhà máy ABC - KCN Đình Vũ, Hải Phòng"
                readOnly
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 font-medium cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
