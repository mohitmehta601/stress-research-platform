package com.pulselab.checkin;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Locale;

@CapacitorPlugin(
    name = "AudioStorage",
    permissions = {
        @Permission(alias = "publicStorage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
    }
)
public class AudioStoragePlugin extends Plugin {
    private static final String ROOT_FOLDER = "StressSense Audio";
    private static final String PUBLIC_ROOT = Environment.DIRECTORY_DOWNLOADS + "/" + ROOT_FOLDER;

    @Override
    @PluginMethod
    public void checkPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            JSObject result = new JSObject();
            result.put("publicStorage", PermissionState.GRANTED.toString());
            call.resolve(result);
            return;
        }
        super.checkPermissions(call);
    }

    @Override
    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            JSObject result = new JSObject();
            result.put("publicStorage", PermissionState.GRANTED.toString());
            call.resolve(result);
            return;
        }
        super.requestPermissions(call);
    }

    @PluginMethod
    public void saveAudio(PluginCall call) {
        String base64Data = call.getString("base64Data");
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "audio/webm");
        String sessionType = call.getString("sessionType");

        if (base64Data == null || base64Data.trim().isEmpty()) {
            call.reject("The completed recording was empty.");
            return;
        }
        if (fileName == null || fileName.trim().isEmpty()) {
            call.reject("Audio filename is missing.");
            return;
        }

        String subfolder = getSessionSubfolder(sessionType);
        if (subfolder == null) {
            call.reject("Unsupported session type. Choose Relaxed or Stress and try again.");
            return;
        }

        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P && getPermissionState("publicStorage") != PermissionState.GRANTED) {
            call.reject("Storage permission is required to save audio on Android 9 or older.");
            return;
        }

        byte[] audioBytes;
        try {
            audioBytes = Base64.decode(base64Data, Base64.DEFAULT);
        } catch (IllegalArgumentException exception) {
            call.reject("The completed recording could not be decoded.", exception);
            return;
        }

        if (audioBytes.length == 0) {
            call.reject("The completed recording was empty.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveWithMediaStore(call, audioBytes, fileName, mimeType, subfolder);
        } else {
            saveLegacyPublicFile(call, audioBytes, fileName, mimeType, subfolder);
        }
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        getActivity().startActivity(intent);
        call.resolve();
    }

    private void saveWithMediaStore(PluginCall call, byte[] audioBytes, String fileName, String mimeType, String subfolder) {
        ContentResolver resolver = getContext().getContentResolver();
        String relativePath = PUBLIC_ROOT + "/" + subfolder + "/";
        String uniqueName = fileName;
        Uri collection = MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        Uri itemUri = null;

        try {
            uniqueName = uniqueDisplayName(resolver, collection, relativePath, fileName);

            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, uniqueName);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath);
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);

            itemUri = resolver.insert(collection, values);
            if (itemUri == null) {
                call.reject("Could not create the StressSense Audio folder in Download.");
                return;
            }

            try (OutputStream outputStream = resolver.openOutputStream(itemUri)) {
                if (outputStream == null) {
                    resolver.delete(itemUri, null, null);
                    call.reject("Could not open the destination audio file.");
                    return;
                }
                outputStream.write(audioBytes);
            }

            ContentValues completedValues = new ContentValues();
            completedValues.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(itemUri, completedValues, null, null);

            resolveSave(call, uniqueName, relativePath, itemUri.toString());
        } catch (Exception exception) {
            if (itemUri != null) resolver.delete(itemUri, null, null);
            call.reject("Audio could not be saved to phone storage: " + exception.getMessage(), exception);
        }
    }

    private void saveLegacyPublicFile(PluginCall call, byte[] audioBytes, String fileName, String mimeType, String subfolder) {
        File directory = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), ROOT_FOLDER + "/" + subfolder);
        if (!directory.exists() && !directory.mkdirs()) {
            call.reject("Could not create " + directory.getAbsolutePath() + ".");
            return;
        }

        File destination = uniqueFile(directory, fileName);
        try (FileOutputStream outputStream = new FileOutputStream(destination)) {
            outputStream.write(audioBytes);
            MediaScannerConnection.scanFile(getContext(), new String[] { destination.getAbsolutePath() }, new String[] { mimeType }, null);
            resolveSave(call, destination.getName(), "Download/" + ROOT_FOLDER + "/" + subfolder + "/", destination.getAbsolutePath());
        } catch (Exception exception) {
            call.reject("Audio could not be copied to " + destination.getAbsolutePath() + ".", exception);
        }
    }

    private void resolveSave(PluginCall call, String fileName, String location, String uri) {
        JSObject result = new JSObject();
        result.put("fileName", fileName);
        result.put("location", "Phone Storage/" + location);
        result.put("uri", uri);
        call.resolve(result);
    }

    private String getSessionSubfolder(String sessionType) {
        if ("relaxed".equals(sessionType)) return "Relaxed Session";
        if ("stress".equals(sessionType)) return "Stress Session";
        return null;
    }

    private String uniqueDisplayName(ContentResolver resolver, Uri collection, String relativePath, String fileName) {
        String name = fileName;
        int suffix = 1;
        while (mediaNameExists(resolver, collection, relativePath, name)) {
            name = addSuffix(fileName, suffix);
            suffix++;
        }
        return name;
    }

    private boolean mediaNameExists(ContentResolver resolver, Uri collection, String relativePath, String fileName) {
        String[] projection = new String[] { MediaStore.MediaColumns._ID };
        String selection = MediaStore.MediaColumns.RELATIVE_PATH + "=? AND " + MediaStore.MediaColumns.DISPLAY_NAME + "=?";
        String[] args = new String[] { relativePath, fileName };
        try (android.database.Cursor cursor = resolver.query(collection, projection, selection, args, null)) {
            return cursor != null && cursor.moveToFirst();
        }
    }

    private File uniqueFile(File directory, String fileName) {
        File file = new File(directory, fileName);
        int suffix = 1;
        while (file.exists()) {
            file = new File(directory, addSuffix(fileName, suffix));
            suffix++;
        }
        return file;
    }

    private String addSuffix(String fileName, int suffix) {
        int dot = fileName.lastIndexOf('.');
        String base = dot > 0 ? fileName.substring(0, dot) : fileName;
        String extension = dot > 0 ? fileName.substring(dot) : "";
        return String.format(Locale.US, "%s_%d%s", base, suffix, extension);
    }
}
