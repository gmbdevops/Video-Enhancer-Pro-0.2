import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { promises as fs } from 'fs';
import yargs from 'yargs';
import chalk from 'chalk';
import { hideBin } from 'yargs/helpers';

interface Args {
  input: string | string[];
  output: string;
  width: number;
  height: number;
  denoise: boolean;
  stabilize: boolean;
  gpu: boolean;
  log: string;
  contrast: number;
  brightness: number;
  saturation: number;
  sharpness: string;
  crop: string;
}

async function logToFile(message: string, logFile: string) {
  const timestamp = new Date().toISOString();
  await fs.appendFile(logFile, `[${timestamp}] ${message}\n`);
}

async function enhanceVideo(
  inputPath: string,
  outputPath: string,
  resolution: { width: number; height: number },
  denoise: boolean,
  stabilize: boolean,
  gpu: boolean,
  logFile: string,
  contrast: number,
  brightness: number,
  saturation: number,
  sharpness: string,
  crop: string
): Promise<void> {
  try {
    await fs.access(inputPath);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Файл ${inputPath} не найден.`);
    } else {
      throw new Error('Неизвестная ошибка при доступе к файлу.');
    }
  }

  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .output(outputPath)
      .size(`${resolution.width}x${resolution.height}`)
      .videoCodec(gpu ? 'h264_nvenc' : 'libx264')
      .outputOptions('-crf', '18')
      .outputOptions('-preset', 'slow');
      if (denoise) {
        command.videoFilter('hqdn3d');
      }
  
      if (stabilize) {
        command
          .videoFilter('vidstabdetect=shakiness=10:accuracy=15')
          .videoFilter('vidstabtransform=smoothing=30:input="transforms.trf"');
      }
  
      if (contrast !== 1 || brightness !== 0 || saturation !== 1) {
        command.videoFilter(`eq=contrast=${contrast}:brightness=${brightness}:saturation=${saturation}`);
      }
  
      if (sharpness) {
        command.videoFilter(`unsharp=${sharpness}`);
      }
  
      if (crop) {
        command.videoFilter(`crop=${crop}`);
      }
  
      command
        .on('start', (commandLine) => {
          const message = `Запущена команда: ${commandLine}`;
          console.log(chalk.blue(message));
          logToFile(message, logFile);
        })
        .on('progress', (progress) => {
          const message = `Обработка: ${Math.floor(progress.percent || 0)}%`;
          console.log(chalk.yellow(message));
          logToFile(message, logFile);
        })
        .on('end', () => {
          const message = `Видео улучшено и сохранено в ${outputPath}`;
          console.log(chalk.green(message));
          logToFile(message, logFile);
          resolve();
        })
        .on('error', (err) => {
          if (err instanceof Error) {
            const message = `Ошибка при обработке видео: ${err.message}`;
            console.error(chalk.red(message));
            logToFile(message, logFile);
            reject(err);
          } else {
            const message = 'Неизвестная ошибка при обработке видео';
            console.error(chalk.red(message));
            logToFile(message, logFile);
            reject(new Error(message));
          }
        })
        .run();
    });
  }
  const argv = yargs(hideBin(process.argv))
  .usage(chalk.green('Usage: $0 -i <input> -o <output> [options]'))
  .example(
    chalk.yellow('$0 -i input.mp4 -o output.mp4'),
    chalk.yellow('Convert input.mp4 to output.mp4 with default settings')
  )
  .option('input', {
    alias: 'i',
    type: 'string',
    description: chalk.cyan('Путь к исходному видео'),
    demandOption: true,
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    description: chalk.cyan('Путь для сохранения видео'),
    demandOption: true,
  })
  .option('width', {
    alias: 'w',
    type: 'number',
    description: chalk.cyan('Ширина (по умолчанию 1920)'),
    default: 1920,
  })
  .option('height', {
    alias: 'h',
    type: 'number',
    description: chalk.cyan('Высота (по умолчанию 1080)'),
    default: 1080,
  })
  .option('denoise', {
    alias: 'd',
    type: 'boolean',
    description: chalk.cyan('Удаление шума'),
    default: true,
  })
  .option('stabilize', {
    alias: 's',
    type: 'boolean',
    description: chalk.cyan('Стабилизация'),
    default: false,
  })
  .option('gpu', {
    alias: 'g',
    type: 'boolean',
    description: chalk.cyan('Использовать GPU'),
    default: false,
  })
  .option('log', {
    alias: 'l',
    type: 'string',
    description: chalk.cyan('Файл логов'),
    default: 'video_master.log',
  })
  .option('contrast', {
    alias: 'c',
    type: 'number',
    description: chalk.cyan('Контраст (по умолчанию 1.0)'),
    default: 1.0,
  })
  .option('brightness', {
    alias: 'b',
    type: 'number',
    description: chalk.cyan('Яркость (по умолчанию 0.0)'),
    default: 0.0,
  })
  .option('saturation', {
    alias: 't',
    type: 'number',
    description: chalk.cyan('Насыщенность (по умолчанию 1.0)'),
    default: 1.0,
  })
  .option('sharpness', {
    alias: 'p',
    type: 'string',
    description: chalk.cyan('Резкость (например, "5:5:1.0:3:3:0.5")'),
    default: '',
  })
  .option('crop', {
    alias: 'r',
    type: 'string',
    description: chalk.cyan('Обрезка (например, "in_w-200:in_h-200")'),
    default: '',
  })
  .help()
  .version()
  .wrap(80)
  .parseSync() as Args;

console.log(chalk.cyan(`\nВыбранные параметры:`));
console.log(chalk.cyan(`- Входной файл(ы): ${argv.input}`));
console.log(chalk.cyan(`- Выходной путь: ${argv.output}`));
console.log(chalk.cyan(`- Разрешение: ${argv.width}x${argv.height}`));
console.log(chalk.cyan(`- Удаление шума: ${argv.denoise}`));
console.log(chalk.cyan(`- Стабилизация: ${argv.stabilize}`));
console.log(chalk.cyan(`- Использование GPU: ${argv.gpu}`));
console.log(chalk.cyan(`- Лог-файл: ${argv.log}`));
console.log(chalk.cyan(`- Контраст: ${argv.contrast}`));
console.log(chalk.cyan(`- Яркость: ${argv.brightness}`));
console.log(chalk.cyan(`- Насыщенность: ${argv.saturation}`));
console.log(chalk.cyan(`- Резкость: ${argv.sharpness}`));
console.log(chalk.cyan(`- Обрезка: ${argv.crop}\n`));
console.log(chalk.magenta(`\nРекомендуемые настройки для улучшения качества:`));
console.log(chalk.magenta(`- Качество сжатия: -crf 18`));
console.log(chalk.magenta(`- Предустановка кодирования: -preset slow`));
console.log(chalk.magenta(`- Фильтр резкости: -vf unsharp=5:5:0.8:3:3:0.4`));
console.log(chalk.magenta(`- Цветокоррекция: -vf eq=contrast=1.2:brightness=0.02:saturation=1.1\n`));

(async () => {
  const { input, output, width, height, denoise, stabilize, gpu, log, contrast, brightness, saturation, sharpness, crop } = argv;

  try {
    if (typeof input === 'string') {
      await enhanceVideo(input, output, { width, height }, denoise, stabilize, gpu, log, contrast, brightness, saturation, sharpness, crop);
    } else if (Array.isArray(input)) {
      for (const file of input) {
        const outputFile = path.join(output, path.basename(file));
        await enhanceVideo(file, outputFile, { width, height }, denoise, stabilize, gpu, log, contrast, brightness, saturation, sharpness, crop);
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`Ошибка: ${error.message}`));
    } else {
      console.error(chalk.red('Неизвестная ошибка'));
    }
    process.exit(1);
  }
})();
  