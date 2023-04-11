// META: global=window
// META: script=/webcodecs/utils.js

function make_silent_audio_data(timestamp, channels, sampleRate, frames) {
  let data = new Float32Array(frames*channels);

  return new AudioData({
    timestamp: timestamp,
    data: data,
    numberOfChannels: channels,
    numberOfFrames: frames,
    sampleRate: sampleRate,
    format: "f32-planar",
  });
}

promise_test(async t => {
  let sample_rate = 48000;
  let total_duration_s = 10;
  let data_count = 100;
  let normal_outputs = [];
  let dtx_outputs = [];

  let normal_encoder = new AudioEncoder({
    error: e => {
      assert_unreached('error: ' + e);
    },
    output: chunk => {
      normal_outputs.push(chunk);
    }
  });

  let dtx_encoder = new AudioEncoder({
    error: e => {
      assert_unreached('error: ' + e);
    },
    output: chunk => {
      dtx_outputs.push(chunk);
    }
  });

  let config = {
    codec: 'opus',
    sampleRate: sample_rate,
    numberOfChannels: 2,
    bitrate: 256000,  // 256kbit
  };

  // Configure one encoder with and one without the DTX flag
  normal_encoder.configure({...config, opus: {usedtx: false}});
  dtx_encoder.configure({...config, opus: {usedtx: true}});

  let timestamp_us = 0;
  let data_duration_s = total_duration_s / data_count;
  let data_length = data_duration_s * config.sampleRate;
  for (let i = 0; i < data_count; i++) {
    let data;

    if (i == 0 || i == (data_count - 1)) {
      // Send real data for the first and last 100ms.
      data = make_audio_data(
          timestamp_us, config.numberOfChannels, config.sampleRate,
          data_length);

    } else {
      // Send silence for the rest of the 10s.
      data = make_silent_audio_data(
          timestamp_us, config.numberOfChannels, config.sampleRate,
          data_length);
    }

    normal_encoder.encode(data);
    dtx_encoder.encode(data);
    data.close();

    timestamp_us += data_duration_s * 1_000_000;
  }

  await Promise.all([normal_encoder.flush(), dtx_encoder.flush()])

  normal_encoder.close();
  dtx_encoder.close();

  // We expect a significant reduction in the number of packets, over ~10s of silence.
  assert_less_than(dtx_outputs.length, (normal_outputs.length / 2));
}, 'Test the Opus DTX flag works.');
